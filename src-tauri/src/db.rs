use crate::error::AppResult;
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode},
    SqlitePool,
};
use std::path::PathBuf;
use std::str::FromStr;
use std::time::Duration;
use tauri::{AppHandle, Manager};

pub async fn init_db(app: &AppHandle) -> AppResult<SqlitePool> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| crate::error::AppError::msg(format!("ไม่พบโฟลเดอร์ข้อมูลแอป: {e}")))?;

    std::fs::create_dir_all(&app_dir)?;

    let db_path = app_dir.join("pos.db");
    let pool = connect_pool(&db_path).await?;
    migrate(&pool).await?;
    Ok(pool)
}

pub fn db_path(app: &AppHandle) -> AppResult<PathBuf> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| crate::error::AppError::msg(format!("ไม่พบโฟลเดอร์ข้อมูลแอป: {e}")))?;
    Ok(app_dir.join("pos.db"))
}

pub async fn connect_pool(db_path: &std::path::Path) -> AppResult<SqlitePool> {
    let options = SqliteConnectOptions::from_str(&format!("sqlite:{}", db_path.display()))?
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(SqliteJournalMode::Wal)
        .busy_timeout(Duration::from_millis(5000));
    Ok(SqlitePool::connect_with(options).await?)
}

#[allow(dead_code)]
pub async fn connect_memory_pool() -> AppResult<SqlitePool> {
    let options = SqliteConnectOptions::from_str("sqlite::memory:")?
        .create_if_missing(true)
        .foreign_keys(true)
        .busy_timeout(Duration::from_millis(5000));
    let pool = SqlitePool::connect_with(options).await?;
    migrate(&pool).await?;
    Ok(pool)
}

pub async fn migrate(pool: &SqlitePool) -> AppResult<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY
        )
        "#,
    )
    .execute(pool)
    .await?;

    let current: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) FROM schema_migrations")
        .fetch_one(pool)
        .await?;

    if current < 1 {
        migrate_v1(pool).await?;
        record_version(pool, 1).await?;
    }
    if current < 2 {
        migrate_v2(pool).await?;
        record_version(pool, 2).await?;
    }
    if current < 3 {
        migrate_v3(pool).await?;
        record_version(pool, 3).await?;
    }
    if current < 4 {
        migrate_v4(pool).await?;
        record_version(pool, 4).await?;
    }
    if current < 5 {
        migrate_v5(pool).await?;
        record_version(pool, 5).await?;
    }
    if current < 6 {
        migrate_v6(pool).await?;
        record_version(pool, 6).await?;
    }

    Ok(())
}

async fn record_version(pool: &SqlitePool, version: i64) -> AppResult<()> {
    sqlx::query("INSERT OR IGNORE INTO schema_migrations (version) VALUES (?1)")
        .bind(version)
        .execute(pool)
        .await?;
    Ok(())
}

async fn migrate_v1(pool: &SqlitePool) -> AppResult<()> {
    let statements = [
        r#"
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            barcode TEXT UNIQUE,
            price_satang INTEGER NOT NULL CHECK (price_satang >= 0),
            stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
            low_stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (low_stock_qty >= 0),
            active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS stock_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL REFERENCES products(id),
            qty_delta INTEGER NOT NULL,
            reason TEXT NOT NULL CHECK (reason IN ('receive', 'adjust', 'sale')),
            note TEXT,
            created_at TEXT NOT NULL
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            receipt_no TEXT NOT NULL UNIQUE,
            total_satang INTEGER NOT NULL CHECK (total_satang >= 0),
            paid_satang INTEGER NOT NULL CHECK (paid_satang >= 0),
            change_satang INTEGER NOT NULL CHECK (change_satang >= 0),
            created_at TEXT NOT NULL
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL REFERENCES sales(id),
            product_id INTEGER NOT NULL REFERENCES products(id),
            name TEXT NOT NULL,
            qty INTEGER NOT NULL CHECK (qty > 0),
            unit_price_satang INTEGER NOT NULL CHECK (unit_price_satang >= 0),
            line_total_satang INTEGER NOT NULL CHECK (line_total_satang >= 0)
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS day_closes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business_date TEXT NOT NULL UNIQUE,
            sale_count INTEGER NOT NULL CHECK (sale_count >= 0),
            total_satang INTEGER NOT NULL CHECK (total_satang >= 0),
            closed_at TEXT NOT NULL
        )
        "#,
        "CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)",
        "CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)",
        "CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at)",
        "CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id)",
    ];

    for sql in statements {
        sqlx::query(sql).execute(pool).await?;
    }
    Ok(())
}

async fn migrate_v2(pool: &SqlitePool) -> AppResult<()> {
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id)")
        .execute(pool)
        .await?;
    Ok(())
}

async fn migrate_v3(pool: &SqlitePool) -> AppResult<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS receipt_counters (
            business_date TEXT PRIMARY KEY,
            last_seq INTEGER NOT NULL CHECK (last_seq >= 0)
        )
        "#,
    )
    .execute(pool)
    .await?;
    Ok(())
}

async fn migrate_v4(pool: &SqlitePool) -> AppResult<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    let cols: Vec<String> = sqlx::query_scalar("SELECT name FROM pragma_table_info('sales')")
        .fetch_all(pool)
        .await?;
    if !cols.iter().any(|c| c == "status") {
        sqlx::query(
            "ALTER TABLE sales ADD COLUMN status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'voided'))",
        )
        .execute(pool)
        .await?;
    }
    if !cols.iter().any(|c| c == "voided_at") {
        sqlx::query("ALTER TABLE sales ADD COLUMN voided_at TEXT")
            .execute(pool)
            .await?;
    }

    ensure_stock_movements_allows_void(pool).await?;
    Ok(())
}

async fn migrate_v5(pool: &SqlitePool) -> AppResult<()> {
    let cols: Vec<String> = sqlx::query_scalar("SELECT name FROM pragma_table_info('products')")
        .fetch_all(pool)
        .await?;
    if !cols.iter().any(|c| c == "pinned") {
        sqlx::query(
            "ALTER TABLE products ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1))",
        )
        .execute(pool)
        .await?;
    }
    if !cols.iter().any(|c| c == "pin_order") {
        sqlx::query(
            "ALTER TABLE products ADD COLUMN pin_order INTEGER NOT NULL DEFAULT 0 CHECK (pin_order >= 0)",
        )
        .execute(pool)
        .await?;
    }
    Ok(())
}

async fn migrate_v6(pool: &SqlitePool) -> AppResult<()> {
    let indexes = [
        "CREATE INDEX IF NOT EXISTS idx_products_active ON products(active)",
        "CREATE INDEX IF NOT EXISTS idx_products_pinned ON products(pinned, pin_order)",
        "CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id)",
        "CREATE INDEX IF NOT EXISTS idx_sales_created_status ON sales(created_at, status)",
    ];
    for sql in indexes {
        sqlx::query(sql).execute(pool).await?;
    }
    Ok(())
}

async fn table_exists(pool: &SqlitePool, name: &str) -> AppResult<bool> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
    )
    .bind(name)
    .fetch_one(pool)
    .await?;
    Ok(count > 0)
}

async fn stock_movements_allows_void(pool: &SqlitePool) -> AppResult<bool> {
    if !table_exists(pool, "stock_movements").await? {
        return Ok(false);
    }
    let sql: String = sqlx::query_scalar(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'stock_movements'",
    )
    .fetch_one(pool)
    .await?;
    Ok(sql.contains("'void'"))
}

async fn ensure_stock_movements_allows_void(pool: &SqlitePool) -> AppResult<()> {
    // Resume a previous interrupted swap.
    if table_exists(pool, "stock_movements_new").await? {
        if table_exists(pool, "stock_movements").await? {
            sqlx::query("DROP TABLE stock_movements")
                .execute(pool)
                .await?;
        }
        sqlx::query("ALTER TABLE stock_movements_new RENAME TO stock_movements")
            .execute(pool)
            .await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id)",
        )
        .execute(pool)
        .await?;
        return Ok(());
    }

    if stock_movements_allows_void(pool).await? {
        return Ok(());
    }

    if !table_exists(pool, "stock_movements").await? {
        sqlx::query(
            r#"
            CREATE TABLE stock_movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL REFERENCES products(id),
                qty_delta INTEGER NOT NULL,
                reason TEXT NOT NULL CHECK (reason IN ('receive', 'adjust', 'sale', 'void')),
                note TEXT,
                created_at TEXT NOT NULL
            )
            "#,
        )
        .execute(pool)
        .await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id)",
        )
        .execute(pool)
        .await?;
        return Ok(());
    }

    sqlx::query(
        r#"
        CREATE TABLE stock_movements_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL REFERENCES products(id),
            qty_delta INTEGER NOT NULL,
            reason TEXT NOT NULL CHECK (reason IN ('receive', 'adjust', 'sale', 'void')),
            note TEXT,
            created_at TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO stock_movements_new (id, product_id, qty_delta, reason, note, created_at)
        SELECT id, product_id, qty_delta, reason, note, created_at FROM stock_movements
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query("DROP TABLE stock_movements")
        .execute(pool)
        .await?;
    sqlx::query("ALTER TABLE stock_movements_new RENAME TO stock_movements")
        .execute(pool)
        .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id)",
    )
    .execute(pool)
    .await?;

    Ok(())
}
