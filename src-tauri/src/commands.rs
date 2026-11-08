use crate::error::{map_sqlx, AppError, AppResult};
use crate::models::{
    CheckoutLine, CreateProductInput, DayClose, ImportProductsResult, Product, ProductPage, Sale,
    SaleItem, SaleSummary, ShopSettings, StockMovement, TodayReport, UpdateProductInput,
};
use crate::timeutil::{day_bounds_iso, now_iso, today_business_date};
use sha2::{Digest, Sha256};
use sqlx::{QueryBuilder, Sqlite, SqlitePool, Transaction};
use tauri::{AppHandle, State};

const PIN_SALT: &str = "my-pos-manager-pin-v1";
const PIN_KEY: &str = "manager_pin_hash";
const REPORT_SALES_LIMIT: i64 = 200;

fn normalize_barcode(barcode: &Option<String>) -> Option<String> {
    barcode
        .as_ref()
        .map(|b| b.trim().to_string())
        .filter(|b| !b.is_empty())
}

fn escape_like(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '\\' | '%' | '_' => {
                out.push('\\');
                out.push(ch);
            }
            _ => out.push(ch),
        }
    }
    out
}

fn hash_pin(pin: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(PIN_SALT.as_bytes());
    hasher.update(pin.as_bytes());
    hex::encode(hasher.finalize())
}

fn validate_create_input(input: &CreateProductInput) -> AppResult<()> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(AppError::msg("กรุณาระบุชื่อสินค้า"));
    }
    if input.price_satang < 0 {
        return Err(AppError::msg("ราคาต้องไม่ติดลบ"));
    }
    if input.stock_qty < 0 {
        return Err(AppError::msg("จำนวนสต็อกต้องไม่ติดลบ"));
    }
    if input.low_stock_qty < 0 {
        return Err(AppError::msg("เกณฑ์สต็อกต่ำต้องไม่ติดลบ"));
    }
    Ok(())
}

fn validate_update_input(input: &UpdateProductInput) -> AppResult<()> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(AppError::msg("กรุณาระบุชื่อสินค้า"));
    }
    if input.price_satang < 0 {
        return Err(AppError::msg("ราคาต้องไม่ติดลบ"));
    }
    if input.low_stock_qty < 0 {
        return Err(AppError::msg("เกณฑ์สต็อกต่ำต้องไม่ติดลบ"));
    }
    Ok(())
}

async fn fetch_product(pool: &SqlitePool, id: i64) -> AppResult<Product> {
    let row = map_sqlx(
        sqlx::query_as::<_, ProductRow>(
            r#"
            SELECT id, name, barcode, price_satang, stock_qty, low_stock_qty, active, pinned, pin_order
            FROM products WHERE id = ?1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await,
    )?
    .ok_or_else(|| AppError::msg("ไม่พบสินค้า"))?;
    Ok(row.into())
}

#[derive(sqlx::FromRow)]
struct ProductRow {
    id: i64,
    name: String,
    barcode: Option<String>,
    price_satang: i64,
    stock_qty: i64,
    low_stock_qty: i64,
    active: i64,
    pinned: i64,
    pin_order: i64,
}

impl From<ProductRow> for Product {
    fn from(row: ProductRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            barcode: row.barcode,
            price_satang: row.price_satang,
            stock_qty: row.stock_qty,
            low_stock_qty: row.low_stock_qty,
            active: row.active != 0,
            pinned: row.pinned != 0,
            pin_order: row.pin_order,
        }
    }
}

async fn fetch_product_tx(tx: &mut Transaction<'_, Sqlite>, id: i64) -> AppResult<Product> {
    let row = map_sqlx(
        sqlx::query_as::<_, ProductRow>(
            r#"
            SELECT id, name, barcode, price_satang, stock_qty, low_stock_qty, active, pinned, pin_order
            FROM products WHERE id = ?1
            "#,
        )
        .bind(id)
        .fetch_optional(&mut **tx)
        .await,
    )?
    .ok_or_else(|| AppError::msg("ไม่พบสินค้า"))?;
    Ok(row.into())
}

pub async fn list_products_inner(
    pool: &SqlitePool,
    query: Option<String>,
    include_inactive: bool,
) -> AppResult<Vec<Product>> {
    let q = query.unwrap_or_default().trim().to_string();
    let rows = if q.is_empty() {
        if include_inactive {
            map_sqlx(
                sqlx::query_as::<_, ProductRow>(
                    r#"
                    SELECT id, name, barcode, price_satang, stock_qty, low_stock_qty, active, pinned, pin_order
                    FROM products
                    ORDER BY pinned DESC, pin_order ASC, name COLLATE NOCASE
                    "#,
                )
                .fetch_all(pool)
                .await,
            )?
        } else {
            map_sqlx(
                sqlx::query_as::<_, ProductRow>(
                    r#"
                    SELECT id, name, barcode, price_satang, stock_qty, low_stock_qty, active, pinned, pin_order
                    FROM products
                    WHERE active = 1
                    ORDER BY pinned DESC, pin_order ASC, name COLLATE NOCASE
                    "#,
                )
                .fetch_all(pool)
                .await,
            )?
        }
    } else {
        let like = format!("%{}%", escape_like(&q));
        let is_barcode_like = q.chars().all(|c| c.is_ascii_digit()) && q.len() >= 4;
        if include_inactive {
            let mut rows = map_sqlx(
                sqlx::query_as::<_, ProductRow>(
                    r#"
                    SELECT id, name, barcode, price_satang, stock_qty, low_stock_qty, active, pinned, pin_order
                    FROM products
                    WHERE name LIKE ?1 ESCAPE '\' OR IFNULL(barcode, '') LIKE ?1 ESCAPE '\'
                    ORDER BY
                      CASE WHEN barcode = ?2 THEN 0 ELSE 1 END,
                      pinned DESC,
                      pin_order ASC,
                      name COLLATE NOCASE
                    "#,
                )
                .bind(&like)
                .bind(if is_barcode_like { q.as_str() } else { "" })
                .fetch_all(pool)
                .await,
            )?;
            if is_barcode_like {
                // Already ordered by exact barcode first via CASE
                let _ = &mut rows;
            }
            rows
        } else {
            map_sqlx(
                sqlx::query_as::<_, ProductRow>(
                    r#"
                    SELECT id, name, barcode, price_satang, stock_qty, low_stock_qty, active, pinned, pin_order
                    FROM products
                    WHERE active = 1
                      AND (name LIKE ?1 ESCAPE '\' OR IFNULL(barcode, '') LIKE ?1 ESCAPE '\')
                    ORDER BY
                      CASE WHEN barcode = ?2 THEN 0 ELSE 1 END,
                      pinned DESC,
                      pin_order ASC,
                      name COLLATE NOCASE
                    "#,
                )
                .bind(&like)
                .bind(if is_barcode_like { q.as_str() } else { "" })
                .fetch_all(pool)
                .await,
            )?
        }
    };

    Ok(rows.into_iter().map(Product::from).collect())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn list_products(
    pool: State<'_, SqlitePool>,
    query: Option<String>,
    include_inactive: Option<bool>,
) -> AppResult<Vec<Product>> {
    list_products_inner(pool.inner(), query, include_inactive.unwrap_or(false)).await
}

const PRODUCT_PAGE_DEFAULT_LIMIT: i64 = 50;
const PRODUCT_PAGE_MAX: i64 = 200;

async fn count_products_inner(
    pool: &SqlitePool,
    query: Option<String>,
    include_inactive: bool,
) -> AppResult<i64> {
    let q = query.unwrap_or_default().trim().to_string();
    if q.is_empty() {
        if include_inactive {
            map_sqlx(sqlx::query_scalar("SELECT COUNT(*) FROM products").fetch_one(pool).await)
        } else {
            map_sqlx(
                sqlx::query_scalar("SELECT COUNT(*) FROM products WHERE active = 1")
                    .fetch_one(pool)
                    .await,
            )
        }
    } else {
        let like = format!("%{}%", escape_like(&q));
        if include_inactive {
            map_sqlx(
                sqlx::query_scalar(
                    r#"
                    SELECT COUNT(*) FROM products
                    WHERE name LIKE ?1 ESCAPE '\' OR IFNULL(barcode, '') LIKE ?1 ESCAPE '\'
                    "#,
                )
                .bind(&like)
                .fetch_one(pool)
                .await,
            )
        } else {
            map_sqlx(
                sqlx::query_scalar(
                    r#"
                    SELECT COUNT(*) FROM products
                    WHERE active = 1
                      AND (name LIKE ?1 ESCAPE '\' OR IFNULL(barcode, '') LIKE ?1 ESCAPE '\')
                    "#,
                )
                .bind(&like)
                .fetch_one(pool)
                .await,
            )
        }
    }
}

pub async fn list_products_page_inner(
    pool: &SqlitePool,
    query: Option<String>,
    include_inactive: bool,
    limit: i64,
    offset: i64,
) -> AppResult<ProductPage> {
    let limit = limit.clamp(1, PRODUCT_PAGE_MAX);
    let offset = offset.max(0);
    let total = count_products_inner(pool, query.clone(), include_inactive).await?;

    let q = query.unwrap_or_default().trim().to_string();
    let rows = if q.is_empty() {
        if include_inactive {
            map_sqlx(
                sqlx::query_as::<_, ProductRow>(
                    r#"
                    SELECT id, name, barcode, price_satang, stock_qty, low_stock_qty, active, pinned, pin_order
                    FROM products
                    ORDER BY pinned DESC, pin_order ASC, name COLLATE NOCASE, id ASC
                    LIMIT ?1 OFFSET ?2
                    "#,
                )
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await,
            )?
        } else {
            map_sqlx(
                sqlx::query_as::<_, ProductRow>(
                    r#"
                    SELECT id, name, barcode, price_satang, stock_qty, low_stock_qty, active, pinned, pin_order
                    FROM products
                    WHERE active = 1
                    ORDER BY pinned DESC, pin_order ASC, name COLLATE NOCASE, id ASC
                    LIMIT ?1 OFFSET ?2
                    "#,
                )
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await,
            )?
        }
    } else {
        let like = format!("%{}%", escape_like(&q));
        let is_barcode_like = q.chars().all(|c| c.is_ascii_digit()) && q.len() >= 4;
        if include_inactive {
            map_sqlx(
                sqlx::query_as::<_, ProductRow>(
                    r#"
                    SELECT id, name, barcode, price_satang, stock_qty, low_stock_qty, active, pinned, pin_order
                    FROM products
                    WHERE name LIKE ?1 ESCAPE '\' OR IFNULL(barcode, '') LIKE ?1 ESCAPE '\'
                    ORDER BY
                      CASE WHEN barcode = ?2 THEN 0 ELSE 1 END,
                      pinned DESC,
                      pin_order ASC,
                      name COLLATE NOCASE,
                      id ASC
                    LIMIT ?3 OFFSET ?4
                    "#,
                )
                .bind(&like)
                .bind(if is_barcode_like { q.as_str() } else { "" })
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await,
            )?
        } else {
            map_sqlx(
                sqlx::query_as::<_, ProductRow>(
                    r#"
                    SELECT id, name, barcode, price_satang, stock_qty, low_stock_qty, active, pinned, pin_order
                    FROM products
                    WHERE active = 1
                      AND (name LIKE ?1 ESCAPE '\' OR IFNULL(barcode, '') LIKE ?1 ESCAPE '\')
                    ORDER BY
                      CASE WHEN barcode = ?2 THEN 0 ELSE 1 END,
                      pinned DESC,
                      pin_order ASC,
                      name COLLATE NOCASE,
                      id ASC
                    LIMIT ?3 OFFSET ?4
                    "#,
                )
                .bind(&like)
                .bind(if is_barcode_like { q.as_str() } else { "" })
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await,
            )?
        }
    };

    Ok(ProductPage {
        items: rows.into_iter().map(Product::from).collect(),
        total,
        limit,
        offset,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn list_products_page(
    pool: State<'_, SqlitePool>,
    query: Option<String>,
    include_inactive: Option<bool>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> AppResult<ProductPage> {
    list_products_page_inner(
        pool.inner(),
        query,
        include_inactive.unwrap_or(false),
        limit.unwrap_or(PRODUCT_PAGE_DEFAULT_LIMIT),
        offset.unwrap_or(0),
    )
    .await
}

pub async fn get_low_stock_count_inner(pool: &SqlitePool) -> AppResult<i64> {
    map_sqlx(
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM products
            WHERE active = 1 AND stock_qty <= low_stock_qty
            "#,
        )
        .fetch_one(pool)
        .await,
    )
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_low_stock_count(pool: State<'_, SqlitePool>) -> AppResult<i64> {
    get_low_stock_count_inner(pool.inner()).await
}

pub async fn get_products_by_ids_inner(
    pool: &SqlitePool,
    ids: &[i64],
) -> AppResult<Vec<Product>> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let mut qb = QueryBuilder::new(
        "SELECT id, name, barcode, price_satang, stock_qty, low_stock_qty, active, pinned, pin_order FROM products WHERE id IN (",
    );
    let mut separated = qb.separated(", ");
    for id in ids {
        separated.push_bind(*id);
    }
    qb.push(") ORDER BY name COLLATE NOCASE");
    let rows = map_sqlx(qb.build_query_as::<ProductRow>().fetch_all(pool).await)?;
    Ok(rows.into_iter().map(Product::from).collect())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_products_by_ids(
    pool: State<'_, SqlitePool>,
    ids: Vec<i64>,
) -> AppResult<Vec<Product>> {
    get_products_by_ids_inner(pool.inner(), &ids).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_product_by_barcode(
    pool: State<'_, SqlitePool>,
    barcode: String,
) -> AppResult<Option<Product>> {
    let barcode = barcode.trim().to_string();
    if barcode.is_empty() {
        return Ok(None);
    }
    let row = map_sqlx(
        sqlx::query_as::<_, ProductRow>(
            r#"
            SELECT id, name, barcode, price_satang, stock_qty, low_stock_qty, active, pinned, pin_order
            FROM products
            WHERE barcode = ?1 AND active = 1
            "#,
        )
        .bind(&barcode)
        .fetch_optional(pool.inner())
        .await,
    )?;
    Ok(row.map(Product::from))
}

pub async fn create_product_inner(
    pool: &SqlitePool,
    input: CreateProductInput,
) -> AppResult<Product> {
    validate_create_input(&input)?;
    let name = input.name.trim().to_string();
    let barcode = normalize_barcode(&input.barcode);

    let mut tx = map_sqlx(pool.begin().await)?;
    let result = sqlx::query(
        r#"
        INSERT INTO products (name, barcode, price_satang, stock_qty, low_stock_qty, active)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        "#,
    )
    .bind(&name)
    .bind(&barcode)
    .bind(input.price_satang)
    .bind(input.stock_qty)
    .bind(input.low_stock_qty)
    .bind(if input.active { 1 } else { 0 })
    .execute(&mut *tx)
    .await;

    let id = match result {
        Ok(r) => r.last_insert_rowid(),
        Err(e) => return Err(AppError::from_sqlx(e)),
    };

    if input.stock_qty > 0 {
        map_sqlx(
            sqlx::query(
                r#"
                INSERT INTO stock_movements (product_id, qty_delta, reason, note, created_at)
                VALUES (?1, ?2, 'receive', 'เปิดสต็อกเริ่มต้น', ?3)
                "#,
            )
            .bind(id)
            .bind(input.stock_qty)
            .bind(now_iso())
            .execute(&mut *tx)
            .await,
        )?;
    }

    map_sqlx(tx.commit().await)?;
    fetch_product(pool, id).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn create_product(
    pool: State<'_, SqlitePool>,
    input: CreateProductInput,
) -> AppResult<Product> {
    create_product_inner(pool.inner(), input).await
}

async fn find_product_id_by_barcode(pool: &SqlitePool, barcode: &str) -> AppResult<Option<i64>> {
    map_sqlx(
        sqlx::query_scalar("SELECT id FROM products WHERE barcode = ?1")
            .bind(barcode)
            .fetch_optional(pool)
            .await,
    )
}

/// Import products: create new rows; if barcode already exists, update name/price/low_stock/active
/// (stock is only set on create — existing stock is left unchanged).
pub async fn import_products_inner(
    pool: &SqlitePool,
    rows: Vec<CreateProductInput>,
) -> AppResult<ImportProductsResult> {
    let mut created = 0_i64;
    let mut updated = 0_i64;
    let mut errors = Vec::new();

    for (idx, input) in rows.into_iter().enumerate() {
        let row_no = idx + 2; // header is row 1
        let barcode = normalize_barcode(&input.barcode);
        match barcode {
            Some(ref code) => match find_product_id_by_barcode(pool, code).await {
                Ok(Some(id)) => {
                    let update = UpdateProductInput {
                        name: input.name.clone(),
                        barcode: Some(code.clone()),
                        price_satang: input.price_satang,
                        low_stock_qty: input.low_stock_qty,
                        active: input.active,
                    };
                    match validate_update_input(&update) {
                        Ok(()) => {
                            let name = update.name.trim().to_string();
                            let result = sqlx::query(
                                r#"
                                UPDATE products
                                SET name = ?1, barcode = ?2, price_satang = ?3,
                                    low_stock_qty = ?4, active = ?5
                                WHERE id = ?6
                                "#,
                            )
                            .bind(&name)
                            .bind(code)
                            .bind(update.price_satang)
                            .bind(update.low_stock_qty)
                            .bind(if update.active { 1 } else { 0 })
                            .bind(id)
                            .execute(pool)
                            .await;
                            match result {
                                Ok(_) => updated += 1,
                                Err(e) => {
                                    errors.push(format!("แถว {row_no}: {}", AppError::from_sqlx(e)))
                                }
                            }
                        }
                        Err(e) => errors.push(format!("แถว {row_no}: {e}")),
                    }
                }
                Ok(None) => match create_product_inner(pool, input).await {
                    Ok(_) => created += 1,
                    Err(e) => errors.push(format!("แถว {row_no}: {e}")),
                },
                Err(e) => errors.push(format!("แถว {row_no}: {e}")),
            },
            None => match create_product_inner(pool, input).await {
                Ok(_) => created += 1,
                Err(e) => errors.push(format!("แถว {row_no}: {e}")),
            },
        }
    }

    Ok(ImportProductsResult {
        created,
        updated,
        errors,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn import_products(
    pool: State<'_, SqlitePool>,
    rows: Vec<CreateProductInput>,
) -> AppResult<ImportProductsResult> {
    if rows.is_empty() {
        return Err(AppError::msg("ไม่มีข้อมูลสำหรับนำเข้า"));
    }
    if rows.len() > 5000 {
        return Err(AppError::msg("นำเข้าได้สูงสุด 5000 แถวต่อครั้ง"));
    }
    import_products_inner(pool.inner(), rows).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn update_product(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateProductInput,
) -> AppResult<Product> {
    validate_update_input(&input)?;
    let name = input.name.trim().to_string();
    let barcode = normalize_barcode(&input.barcode);

    let result = sqlx::query(
        r#"
        UPDATE products
        SET name = ?1, barcode = ?2, price_satang = ?3,
            low_stock_qty = ?4, active = ?5
        WHERE id = ?6
        "#,
    )
    .bind(&name)
    .bind(&barcode)
    .bind(input.price_satang)
    .bind(input.low_stock_qty)
    .bind(if input.active { 1 } else { 0 })
    .bind(id)
    .execute(pool.inner())
    .await;

    match result {
        Ok(r) => {
            if r.rows_affected() == 0 {
                return Err(AppError::msg("ไม่พบสินค้า"));
            }
            fetch_product(pool.inner(), id).await
        }
        Err(e) => Err(AppError::from_sqlx(e)),
    }
}

pub async fn delete_product_inner(
    pool: &SqlitePool,
    id: i64,
    pin: Option<&str>,
) -> AppResult<()> {
    require_manager_pin(pool, pin).await?;

    let sale_refs: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sale_items WHERE product_id = ?1",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(AppError::from_sqlx)?;
    if sale_refs > 0 {
        return Err(AppError::msg(
            "ไม่สามารถลบสินค้าที่เคยขายแล้วได้ — ให้ปิดการขายแทน",
        ));
    }

    let mut tx = map_sqlx(pool.begin().await)?;

    let exists: Option<i64> = sqlx::query_scalar("SELECT id FROM products WHERE id = ?1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::from_sqlx)?;
    if exists.is_none() {
        return Err(AppError::msg("ไม่พบสินค้า"));
    }

    sqlx::query("DELETE FROM stock_movements WHERE product_id = ?1")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from_sqlx)?;

    let deleted = sqlx::query("DELETE FROM products WHERE id = ?1")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from_sqlx)?;
    if deleted.rows_affected() == 0 {
        return Err(AppError::msg("ไม่พบสินค้า"));
    }

    map_sqlx(tx.commit().await)?;
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn delete_product(
    pool: State<'_, SqlitePool>,
    id: i64,
    pin: Option<String>,
) -> AppResult<()> {
    delete_product_inner(pool.inner(), id, pin.as_deref()).await
}

const MAX_PINNED_PRODUCTS: i64 = 24;

#[tauri::command(rename_all = "camelCase")]
pub async fn set_product_pinned(
    pool: State<'_, SqlitePool>,
    id: i64,
    pinned: bool,
) -> AppResult<Product> {
    if pinned {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM products WHERE pinned = 1 AND id != ?1",
        )
        .bind(id)
        .fetch_one(pool.inner())
        .await
        .map_err(AppError::from_sqlx)?;
        if count >= MAX_PINNED_PRODUCTS {
            return Err(AppError::msg(format!(
                "ปักหมุดได้สูงสุด {MAX_PINNED_PRODUCTS} รายการ"
            )));
        }
        let next_order: i64 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(pin_order), 0) + 1 FROM products WHERE pinned = 1",
        )
        .fetch_one(pool.inner())
        .await
        .map_err(AppError::from_sqlx)?;
        let result = sqlx::query(
            "UPDATE products SET pinned = 1, pin_order = ?1 WHERE id = ?2",
        )
        .bind(next_order)
        .bind(id)
        .execute(pool.inner())
        .await;
        match result {
            Ok(r) => {
                if r.rows_affected() == 0 {
                    return Err(AppError::msg("ไม่พบสินค้า"));
                }
                fetch_product(pool.inner(), id).await
            }
            Err(e) => Err(AppError::from_sqlx(e)),
        }
    } else {
        let result = sqlx::query(
            "UPDATE products SET pinned = 0, pin_order = 0 WHERE id = ?1",
        )
        .bind(id)
        .execute(pool.inner())
        .await;
        match result {
            Ok(r) => {
                if r.rows_affected() == 0 {
                    return Err(AppError::msg("ไม่พบสินค้า"));
                }
                fetch_product(pool.inner(), id).await
            }
            Err(e) => Err(AppError::from_sqlx(e)),
        }
    }
}

pub async fn receive_stock_inner(
    pool: &SqlitePool,
    product_id: i64,
    qty: i64,
    note: Option<String>,
) -> AppResult<Product> {
    if qty <= 0 {
        return Err(AppError::msg("จำนวนรับเข้าต้องมากกว่า 0"));
    }

    let mut tx = map_sqlx(pool.begin().await)?;
    let product = fetch_product_tx(&mut tx, product_id).await?;
    product
        .stock_qty
        .checked_add(qty)
        .ok_or_else(|| AppError::msg("จำนวนสต็อกเกินขอบเขต"))?;

    map_sqlx(
        sqlx::query("UPDATE products SET stock_qty = stock_qty + ?1 WHERE id = ?2")
            .bind(qty)
            .bind(product_id)
            .execute(&mut *tx)
            .await,
    )?;

    map_sqlx(
        sqlx::query(
            r#"
            INSERT INTO stock_movements (product_id, qty_delta, reason, note, created_at)
            VALUES (?1, ?2, 'receive', ?3, ?4)
            "#,
        )
        .bind(product_id)
        .bind(qty)
        .bind(note.filter(|n| !n.trim().is_empty()))
        .bind(now_iso())
        .execute(&mut *tx)
        .await,
    )?;

    map_sqlx(tx.commit().await)?;
    fetch_product(pool, product_id).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn receive_stock(
    pool: State<'_, SqlitePool>,
    product_id: i64,
    qty: i64,
    note: Option<String>,
) -> AppResult<Product> {
    receive_stock_inner(pool.inner(), product_id, qty, note).await
}

pub async fn adjust_stock_inner(
    pool: &SqlitePool,
    product_id: i64,
    new_qty: i64,
    note: Option<String>,
    pin: Option<String>,
) -> AppResult<Product> {
    if new_qty < 0 {
        return Err(AppError::msg("จำนวนสต็อกต้องไม่ติดลบ"));
    }
    require_manager_pin(pool, pin.as_deref()).await?;

    let mut tx = map_sqlx(pool.begin().await)?;
    let product = fetch_product_tx(&mut tx, product_id).await?;
    let delta = new_qty - product.stock_qty;
    if delta == 0 {
        return Err(AppError::msg("จำนวนสต็อกไม่เปลี่ยนแปลง"));
    }

    map_sqlx(
        sqlx::query("UPDATE products SET stock_qty = ?1 WHERE id = ?2")
            .bind(new_qty)
            .bind(product_id)
            .execute(&mut *tx)
            .await,
    )?;

    map_sqlx(
        sqlx::query(
            r#"
            INSERT INTO stock_movements (product_id, qty_delta, reason, note, created_at)
            VALUES (?1, ?2, 'adjust', ?3, ?4)
            "#,
        )
        .bind(product_id)
        .bind(delta)
        .bind(note.filter(|n| !n.trim().is_empty()))
        .bind(now_iso())
        .execute(&mut *tx)
        .await,
    )?;

    map_sqlx(tx.commit().await)?;
    fetch_product(pool, product_id).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn adjust_stock(
    pool: State<'_, SqlitePool>,
    product_id: i64,
    new_qty: i64,
    note: Option<String>,
    pin: Option<String>,
) -> AppResult<Product> {
    adjust_stock_inner(pool.inner(), product_id, new_qty, note, pin).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn list_stock_movements(
    pool: State<'_, SqlitePool>,
    limit: Option<i64>,
) -> AppResult<Vec<StockMovement>> {
    let limit = limit.unwrap_or(50).clamp(1, 200);
    map_sqlx(
        sqlx::query_as::<_, StockMovement>(
            r#"
            SELECT m.id, m.product_id, p.name AS product_name, m.qty_delta, m.reason, m.note, m.created_at
            FROM stock_movements m
            JOIN products p ON p.id = m.product_id
            ORDER BY m.id DESC
            LIMIT ?1
            "#,
        )
        .bind(limit)
        .fetch_all(pool.inner())
        .await,
    )
}

async fn is_day_closed(pool: &SqlitePool, business_date: &str) -> AppResult<bool> {
    let count: i64 = map_sqlx(
        sqlx::query_scalar("SELECT COUNT(*) FROM day_closes WHERE business_date = ?1")
            .bind(business_date)
            .fetch_one(pool)
            .await,
    )?;
    Ok(count > 0)
}

pub async fn next_receipt_no(
    tx: &mut Transaction<'_, Sqlite>,
    business_date: &str,
) -> AppResult<String> {
    let date = business_date.replace('-', "");
    map_sqlx(
        sqlx::query(
            r#"
            INSERT INTO receipt_counters (business_date, last_seq)
            VALUES (?1, 1)
            ON CONFLICT(business_date) DO UPDATE SET last_seq = last_seq + 1
            "#,
        )
        .bind(business_date)
        .execute(&mut **tx)
        .await,
    )?;
    let seq: i64 = map_sqlx(
        sqlx::query_scalar("SELECT last_seq FROM receipt_counters WHERE business_date = ?1")
            .bind(business_date)
            .fetch_one(&mut **tx)
            .await,
    )?;
    Ok(format!("R{date}-{seq:04}"))
}

pub async fn checkout_inner(
    pool: &SqlitePool,
    lines: Vec<CheckoutLine>,
    paid_satang: i64,
) -> AppResult<Sale> {
    if lines.is_empty() {
        return Err(AppError::msg("ตะกร้าว่าง"));
    }
    if paid_satang < 0 {
        return Err(AppError::msg("จำนวนเงินที่รับต้องไม่ติดลบ"));
    }

    let business_date = today_business_date();
    if is_day_closed(pool, &business_date).await? {
        return Err(AppError::msg(
            "ปิดยอดวันนี้แล้ว ไม่สามารถขายเพิ่มได้",
        ));
    }

    let mut merged: Vec<CheckoutLine> = Vec::new();
    for line in lines {
        if line.qty <= 0 {
            return Err(AppError::msg("จำนวนสินค้าต้องมากกว่า 0"));
        }
        if let Some(existing) = merged.iter_mut().find(|l| l.product_id == line.product_id) {
            existing.qty += line.qty;
        } else {
            merged.push(line);
        }
    }

    let mut tx = map_sqlx(pool.begin().await)?;
    let mut items: Vec<(Product, i64, i64, i64)> = Vec::new();
    let mut total_satang: i64 = 0;

    for line in &merged {
        let product = fetch_product_tx(&mut tx, line.product_id).await?;
        if !product.active {
            return Err(AppError::msg(format!(
                "สินค้า \"{}\" ถูกปิดการขาย",
                product.name
            )));
        }
        if product.stock_qty < line.qty {
            return Err(AppError::msg(format!(
                "สินค้า \"{}\" สต็อกไม่พอ (เหลือ {})",
                product.name, product.stock_qty
            )));
        }
        let line_total = product
            .price_satang
            .checked_mul(line.qty)
            .ok_or_else(|| AppError::msg("ยอดเงินเกินขอบเขต"))?;
        total_satang = total_satang
            .checked_add(line_total)
            .ok_or_else(|| AppError::msg("ยอดเงินเกินขอบเขต"))?;
        let unit_price = product.price_satang;
        items.push((product, line.qty, unit_price, line_total));
    }

    if paid_satang < total_satang {
        return Err(AppError::msg(format!(
            "รับเงินไม่พอ ต้องชำระอย่างน้อย {:.2} บาท",
            total_satang as f64 / 100.0
        )));
    }
    let change_satang = paid_satang - total_satang;
    let created_at = now_iso();
    let receipt_no = next_receipt_no(&mut tx, &business_date).await?;

    let sale_result = map_sqlx(
        sqlx::query(
            r#"
            INSERT INTO sales (receipt_no, total_satang, paid_satang, change_satang, created_at, status)
            VALUES (?1, ?2, ?3, ?4, ?5, 'open')
            "#,
        )
        .bind(&receipt_no)
        .bind(total_satang)
        .bind(paid_satang)
        .bind(change_satang)
        .bind(&created_at)
        .execute(&mut *tx)
        .await,
    )?;
    let sale_id = sale_result.last_insert_rowid();

    let mut sale_items = Vec::new();
    for (product, qty, unit_price, line_total) in &items {
        let item_result = map_sqlx(
            sqlx::query(
                r#"
                INSERT INTO sale_items (sale_id, product_id, name, qty, unit_price_satang, line_total_satang)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                "#,
            )
            .bind(sale_id)
            .bind(product.id)
            .bind(&product.name)
            .bind(qty)
            .bind(unit_price)
            .bind(line_total)
            .execute(&mut *tx)
            .await,
        )?;

        let updated = map_sqlx(
            sqlx::query(
                "UPDATE products SET stock_qty = stock_qty - ?1 WHERE id = ?2 AND stock_qty >= ?1",
            )
            .bind(qty)
            .bind(product.id)
            .execute(&mut *tx)
            .await,
        )?;
        if updated.rows_affected() == 0 {
            return Err(AppError::msg(format!(
                "สินค้า \"{}\" สต็อกไม่พอ (เหลือ {})",
                product.name, product.stock_qty
            )));
        }

        map_sqlx(
            sqlx::query(
                r#"
                INSERT INTO stock_movements (product_id, qty_delta, reason, note, created_at)
                VALUES (?1, ?2, 'sale', ?3, ?4)
                "#,
            )
            .bind(product.id)
            .bind(-qty)
            .bind(format!("ใบเสร็จ {receipt_no}"))
            .bind(&created_at)
            .execute(&mut *tx)
            .await,
        )?;

        sale_items.push(SaleItem {
            id: item_result.last_insert_rowid(),
            sale_id,
            product_id: product.id,
            name: product.name.clone(),
            qty: *qty,
            unit_price_satang: *unit_price,
            line_total_satang: *line_total,
        });
    }

    map_sqlx(tx.commit().await)?;

    Ok(Sale {
        id: sale_id,
        receipt_no,
        total_satang,
        paid_satang,
        change_satang,
        created_at,
        status: "open".into(),
        voided_at: None,
        items: sale_items,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn checkout(
    pool: State<'_, SqlitePool>,
    lines: Vec<CheckoutLine>,
    paid_satang: i64,
) -> AppResult<Sale> {
    checkout_inner(pool.inner(), lines, paid_satang).await
}

pub async fn get_today_report_inner(pool: &SqlitePool) -> AppResult<TodayReport> {
    let business_date = today_business_date();
    let (start, end) = day_bounds_iso(&business_date).map_err(AppError::msg)?;

    let sale_count: i64 = map_sqlx(
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM sales
            WHERE created_at >= ?1 AND created_at < ?2 AND status = 'open'
            "#,
        )
        .bind(&start)
        .bind(&end)
        .fetch_one(pool)
        .await,
    )?;

    let total_satang: i64 = map_sqlx(
        sqlx::query_scalar(
            r#"
            SELECT COALESCE(SUM(total_satang), 0) FROM sales
            WHERE created_at >= ?1 AND created_at < ?2 AND status = 'open'
            "#,
        )
        .bind(&start)
        .bind(&end)
        .fetch_one(pool)
        .await,
    )?;

    let sales = map_sqlx(
        sqlx::query_as::<_, SaleSummary>(
            r#"
            SELECT id, receipt_no, total_satang, paid_satang, change_satang, created_at, status, voided_at
            FROM sales
            WHERE created_at >= ?1 AND created_at < ?2
            ORDER BY id DESC
            LIMIT ?3
            "#,
        )
        .bind(&start)
        .bind(&end)
        .bind(REPORT_SALES_LIMIT)
        .fetch_all(pool)
        .await,
    )?;

    let day_closed = is_day_closed(pool, &business_date).await?;

    Ok(TodayReport {
        business_date,
        sale_count,
        total_satang,
        day_closed,
        sales,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_today_report(pool: State<'_, SqlitePool>) -> AppResult<TodayReport> {
    get_today_report_inner(pool.inner()).await
}

async fn load_sale(pool: &SqlitePool, id: i64) -> AppResult<Sale> {
    let summary = map_sqlx(
        sqlx::query_as::<_, SaleSummary>(
            r#"
            SELECT id, receipt_no, total_satang, paid_satang, change_satang, created_at, status, voided_at
            FROM sales WHERE id = ?1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await,
    )?
    .ok_or_else(|| AppError::msg("ไม่พบใบเสร็จ"))?;

    let items = map_sqlx(
        sqlx::query_as::<_, SaleItem>(
            r#"
            SELECT id, sale_id, product_id, name, qty, unit_price_satang, line_total_satang
            FROM sale_items WHERE sale_id = ?1
            ORDER BY id
            "#,
        )
        .bind(id)
        .fetch_all(pool)
        .await,
    )?;

    Ok(Sale {
        id: summary.id,
        receipt_no: summary.receipt_no,
        total_satang: summary.total_satang,
        paid_satang: summary.paid_satang,
        change_satang: summary.change_satang,
        created_at: summary.created_at,
        status: summary.status,
        voided_at: summary.voided_at,
        items,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_sale(pool: State<'_, SqlitePool>, id: i64) -> AppResult<Sale> {
    load_sale(pool.inner(), id).await
}

pub async fn close_day_inner(pool: &SqlitePool, pin: Option<&str>) -> AppResult<DayClose> {
    require_manager_pin(pool, pin).await?;

    let business_date = today_business_date();
    let (start, end) = day_bounds_iso(&business_date).map_err(AppError::msg)?;

    let sale_count: i64 = map_sqlx(
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM sales
            WHERE created_at >= ?1 AND created_at < ?2 AND status = 'open'
            "#,
        )
        .bind(&start)
        .bind(&end)
        .fetch_one(pool)
        .await,
    )?;

    let total_satang: i64 = map_sqlx(
        sqlx::query_scalar(
            r#"
            SELECT COALESCE(SUM(total_satang), 0) FROM sales
            WHERE created_at >= ?1 AND created_at < ?2 AND status = 'open'
            "#,
        )
        .bind(&start)
        .bind(&end)
        .fetch_one(pool)
        .await,
    )?;

    let closed_at = now_iso();

    map_sqlx(
        sqlx::query(
            r#"
            INSERT INTO day_closes (business_date, sale_count, total_satang, closed_at)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(business_date) DO UPDATE SET
                sale_count = excluded.sale_count,
                total_satang = excluded.total_satang,
                closed_at = excluded.closed_at
            "#,
        )
        .bind(&business_date)
        .bind(sale_count)
        .bind(total_satang)
        .bind(&closed_at)
        .execute(pool)
        .await,
    )?;

    map_sqlx(
        sqlx::query_as::<_, DayClose>(
            r#"
            SELECT id, business_date, sale_count, total_satang, closed_at
            FROM day_closes WHERE business_date = ?1
            "#,
        )
        .bind(&business_date)
        .fetch_one(pool)
        .await,
    )
}

#[tauri::command(rename_all = "camelCase")]
pub async fn close_day(pool: State<'_, SqlitePool>, pin: Option<String>) -> AppResult<DayClose> {
    close_day_inner(pool.inner(), pin.as_deref()).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn list_day_closes(pool: State<'_, SqlitePool>) -> AppResult<Vec<DayClose>> {
    map_sqlx(
        sqlx::query_as::<_, DayClose>(
            r#"
            SELECT id, business_date, sale_count, total_satang, closed_at
            FROM day_closes
            ORDER BY business_date DESC
            LIMIT 30
            "#,
        )
        .fetch_all(pool.inner())
        .await,
    )
}

async fn get_setting(pool: &SqlitePool, key: &str) -> AppResult<Option<String>> {
    map_sqlx(
        sqlx::query_scalar("SELECT value FROM app_settings WHERE key = ?1")
            .bind(key)
            .fetch_optional(pool)
            .await,
    )
}

async fn set_setting(pool: &SqlitePool, key: &str, value: &str) -> AppResult<()> {
    map_sqlx(
        sqlx::query(
            r#"
            INSERT INTO app_settings (key, value) VALUES (?1, ?2)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            "#,
        )
        .bind(key)
        .bind(value)
        .execute(pool)
        .await,
    )?;
    Ok(())
}

pub async fn has_manager_pin_inner(pool: &SqlitePool) -> AppResult<bool> {
    Ok(get_setting(pool, PIN_KEY).await?.is_some())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn has_manager_pin(pool: State<'_, SqlitePool>) -> AppResult<bool> {
    has_manager_pin_inner(pool.inner()).await
}

pub async fn set_manager_pin_inner(
    pool: &SqlitePool,
    old_pin: Option<&str>,
    new_pin: &str,
) -> AppResult<()> {
    let new_pin = new_pin.trim();
    if new_pin.len() < 4 {
        return Err(AppError::msg("รหัส PIN ต้องมีอย่างน้อย 4 ตัวอักษ"));
    }
    let existing = get_setting(pool, PIN_KEY).await?;
    match existing {
        None => {
            set_setting(pool, PIN_KEY, &hash_pin(new_pin)).await?;
        }
        Some(hash) => {
            let old = old_pin.unwrap_or("").trim();
            if hash_pin(old) != hash {
                return Err(AppError::msg("รหัส PIN เดิมไม่ถูกต้อง"));
            }
            set_setting(pool, PIN_KEY, &hash_pin(new_pin)).await?;
        }
    }
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn set_manager_pin(
    pool: State<'_, SqlitePool>,
    old_pin: Option<String>,
    new_pin: String,
) -> AppResult<()> {
    set_manager_pin_inner(pool.inner(), old_pin.as_deref(), &new_pin).await
}

pub async fn verify_manager_pin_inner(pool: &SqlitePool, pin: &str) -> AppResult<bool> {
    let Some(hash) = get_setting(pool, PIN_KEY).await? else {
        return Ok(false);
    };
    Ok(hash_pin(pin.trim()) == hash)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn verify_manager_pin(pool: State<'_, SqlitePool>, pin: String) -> AppResult<bool> {
    verify_manager_pin_inner(pool.inner(), &pin).await
}

async fn require_manager_pin(pool: &SqlitePool, pin: Option<&str>) -> AppResult<()> {
    let Some(stored) = get_setting(pool, PIN_KEY).await? else {
        return Err(AppError::msg(
            "ยังไม่ได้ตั้งรหัสผู้จัดการ — ไปที่รายงานเพื่อตั้ง PIN",
        ));
    };
    let pin = pin.unwrap_or("").trim();
    if pin.is_empty() || hash_pin(pin) != stored {
        return Err(AppError::msg("รหัสผู้จัดการไม่ถูกต้อง"));
    }
    Ok(())
}

pub async fn void_sale_inner(pool: &SqlitePool, id: i64, pin: Option<&str>) -> AppResult<Sale> {
    require_manager_pin(pool, pin).await?;

    let mut tx = map_sqlx(pool.begin().await)?;
    let summary = map_sqlx(
        sqlx::query_as::<_, SaleSummary>(
            r#"
            SELECT id, receipt_no, total_satang, paid_satang, change_satang, created_at, status, voided_at
            FROM sales WHERE id = ?1
            "#,
        )
        .bind(id)
        .fetch_optional(&mut *tx)
        .await,
    )?
    .ok_or_else(|| AppError::msg("ไม่พบใบเสร็จ"))?;

    if summary.status == "voided" {
        return Err(AppError::msg("ใบเสร็จนี้ถูกยกเลิกแล้ว"));
    }

    let business_date = today_business_date();
    let (start, end) = day_bounds_iso(&business_date).map_err(AppError::msg)?;
    if summary.created_at < start || summary.created_at >= end {
        return Err(AppError::msg("ยกเลิกได้เฉพาะใบเสร็จของวันนี้"));
    }

    let items = map_sqlx(
        sqlx::query_as::<_, SaleItem>(
            r#"
            SELECT id, sale_id, product_id, name, qty, unit_price_satang, line_total_satang
            FROM sale_items WHERE sale_id = ?1
            ORDER BY id
            "#,
        )
        .bind(id)
        .fetch_all(&mut *tx)
        .await,
    )?;

    let voided_at = now_iso();
    for item in &items {
        map_sqlx(
            sqlx::query("UPDATE products SET stock_qty = stock_qty + ?1 WHERE id = ?2")
                .bind(item.qty)
                .bind(item.product_id)
                .execute(&mut *tx)
                .await,
        )?;
        map_sqlx(
            sqlx::query(
                r#"
                INSERT INTO stock_movements (product_id, qty_delta, reason, note, created_at)
                VALUES (?1, ?2, 'void', ?3, ?4)
                "#,
            )
            .bind(item.product_id)
            .bind(item.qty)
            .bind(format!("ยกเลิกใบเสร็จ {}", summary.receipt_no))
            .bind(&voided_at)
            .execute(&mut *tx)
            .await,
        )?;
    }

    map_sqlx(
        sqlx::query(
            "UPDATE sales SET status = 'voided', voided_at = ?1 WHERE id = ?2 AND status = 'open'",
        )
        .bind(&voided_at)
        .bind(id)
        .execute(&mut *tx)
        .await,
    )?;

    map_sqlx(tx.commit().await)?;
    load_sale(pool, id).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn void_sale(
    pool: State<'_, SqlitePool>,
    id: i64,
    pin: Option<String>,
) -> AppResult<Sale> {
    void_sale_inner(pool.inner(), id, pin.as_deref()).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn backup_database(app: AppHandle, pool: State<'_, SqlitePool>) -> AppResult<String> {
    // Checkpoint WAL so the main db file is consistent
    map_sqlx(sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)").execute(pool.inner()).await)?;

    let src = crate::db::db_path(&app)?;
    let app_dir = src
        .parent()
        .ok_or_else(|| AppError::msg("ไม่พบโฟลเดอร์ข้อมูลแอป"))?;
    let backup_dir = app_dir.join("backups");
    std::fs::create_dir_all(&backup_dir)?;

    let stamp = now_iso()
        .replace(':', "")
        .replace('-', "")
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(15)
        .collect::<String>();
    let dest = backup_dir.join(format!("pos-{stamp}.db"));
    std::fs::copy(&src, &dest)?;
    Ok(dest.display().to_string())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_data_dir(app: AppHandle) -> AppResult<String> {
    let path = crate::db::db_path(&app)?;
    let dir = path
        .parent()
        .ok_or_else(|| AppError::msg("ไม่พบโฟลเดอร์ข้อมูลแอป"))?;
    Ok(dir.display().to_string())
}

fn setting_bool(raw: Option<String>) -> bool {
    matches!(
        raw.as_deref().map(|s| s.trim().to_lowercase()).as_deref(),
        Some("1" | "true" | "yes")
    )
}

pub async fn get_shop_settings_inner(pool: &SqlitePool) -> AppResult<ShopSettings> {
    let mut settings = ShopSettings::default();
    if let Some(v) = get_setting(pool, "shop_name").await? {
        if !v.trim().is_empty() {
            settings.shop_name = v;
        }
    }
    if let Some(v) = get_setting(pool, "shop_address").await? {
        settings.shop_address = v;
    }
    settings.auto_print = setting_bool(get_setting(pool, "auto_print").await?);
    settings.sound_enabled = setting_bool(get_setting(pool, "sound_enabled").await?);
    settings.onboarding_done = setting_bool(get_setting(pool, "onboarding_done").await?);
    Ok(settings)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_shop_settings(pool: State<'_, SqlitePool>) -> AppResult<ShopSettings> {
    get_shop_settings_inner(pool.inner()).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn set_shop_settings(
    pool: State<'_, SqlitePool>,
    settings: ShopSettings,
) -> AppResult<ShopSettings> {
    let name = settings.shop_name.trim();
    if name.is_empty() {
        return Err(AppError::msg("กรุณาระบุชื่อร้าน"));
    }
    set_setting(pool.inner(), "shop_name", name).await?;
    set_setting(pool.inner(), "shop_address", settings.shop_address.trim()).await?;
    set_setting(
        pool.inner(),
        "auto_print",
        if settings.auto_print { "1" } else { "0" },
    )
    .await?;
    set_setting(
        pool.inner(),
        "sound_enabled",
        if settings.sound_enabled { "1" } else { "0" },
    )
    .await?;
    set_setting(
        pool.inner(),
        "onboarding_done",
        if settings.onboarding_done { "1" } else { "0" },
    )
    .await?;
    get_shop_settings_inner(pool.inner()).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn export_products_csv(
    pool: State<'_, SqlitePool>,
    include_inactive: Option<bool>,
) -> AppResult<String> {
    let products =
        list_products_inner(pool.inner(), None, include_inactive.unwrap_or(true)).await?;
    let mut out = String::from("name,barcode,price_baht,stock_qty,low_stock_qty,active\n");
    for p in products {
        let barcode = p.barcode.unwrap_or_default().replace('"', "\"\"");
        let name = p.name.replace('"', "\"\"");
        let price = format!("{:.2}", p.price_satang as f64 / 100.0);
        let active = if p.active { "1" } else { "0" };
        out.push_str(&format!(
            "\"{name}\",\"{barcode}\",{price},{},{},{active}\n",
            p.stock_qty, p.low_stock_qty
        ));
    }
    Ok(out)
}
