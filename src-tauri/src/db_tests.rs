#[cfg(test)]
mod tests {
    use crate::commands::{
        adjust_stock_inner, checkout_inner, create_product_inner, delete_product_inner,
        get_low_stock_count_inner, get_today_report_inner, list_products_page_inner,
        next_receipt_no, receive_stock_inner, void_sale_inner,
    };
    use crate::db::connect_memory_pool;
    use crate::models::{CheckoutLine, CreateProductInput};
    use crate::timeutil::{day_bounds_iso, today_business_date};

    async fn seed_product(pool: &sqlx::SqlitePool, stock: i64) -> i64 {
        create_product_inner(
            pool,
            CreateProductInput {
                name: "น้ำดื่ม".into(),
                barcode: Some("8850001".into()),
                price_satang: 1000,
                stock_qty: stock,
                low_stock_qty: 2,
                active: true,
            },
        )
        .await
        .unwrap()
        .id
    }

    #[tokio::test]
    async fn migrate_and_create_product_writes_initial_movement() {
        let pool = connect_memory_pool().await.unwrap();
        let id = seed_product(&pool, 5).await;
        let stock: i64 = sqlx::query_scalar("SELECT stock_qty FROM products WHERE id = ?1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(stock, 5);
        let moves: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM stock_movements WHERE product_id = ?1 AND reason = 'receive'",
        )
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(moves, 1);
    }

    #[tokio::test]
    async fn checkout_decrements_stock_and_writes_sale() {
        let pool = connect_memory_pool().await.unwrap();
        let id = seed_product(&pool, 10).await;
        let sale = checkout_inner(
            &pool,
            vec![CheckoutLine {
                product_id: id,
                qty: 3,
            }],
            5000,
        )
        .await
        .unwrap();
        assert_eq!(sale.change_satang, 2000);
        assert_eq!(sale.status, "open");
        let stock: i64 = sqlx::query_scalar("SELECT stock_qty FROM products WHERE id = ?1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(stock, 7);
    }

    #[tokio::test]
    async fn checkout_merges_lines_and_rejects_insufficient_stock() {
        let pool = connect_memory_pool().await.unwrap();
        let id = seed_product(&pool, 2).await;
        let err = checkout_inner(
            &pool,
            vec![
                CheckoutLine {
                    product_id: id,
                    qty: 2,
                },
                CheckoutLine {
                    product_id: id,
                    qty: 1,
                },
            ],
            10000,
        )
        .await
        .unwrap_err();
        assert!(err.to_string().contains("สต็อกไม่พอ"));
    }

    #[tokio::test]
    async fn receive_stock_is_relative() {
        let pool = connect_memory_pool().await.unwrap();
        let id = seed_product(&pool, 0).await;
        receive_stock_inner(&pool, id, 10, None).await.unwrap();
        receive_stock_inner(&pool, id, 10, None).await.unwrap();
        let stock: i64 = sqlx::query_scalar("SELECT stock_qty FROM products WHERE id = ?1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(stock, 20);
    }

    #[tokio::test]
    async fn receipt_numbers_are_monotonic() {
        let pool = connect_memory_pool().await.unwrap();
        let date = today_business_date();
        let mut tx = pool.begin().await.unwrap();
        let a = next_receipt_no(&mut tx, &date).await.unwrap();
        let b = next_receipt_no(&mut tx, &date).await.unwrap();
        tx.commit().await.unwrap();
        assert_ne!(a, b);
        assert!(a.ends_with("-0001"));
        assert!(b.ends_with("-0002"));
    }

    #[tokio::test]
    async fn close_day_blocks_checkout() {
        let pool = connect_memory_pool().await.unwrap();
        let id = seed_product(&pool, 5).await;
        crate::commands::close_day_inner(&pool).await.unwrap();
        let err = checkout_inner(
            &pool,
            vec![CheckoutLine {
                product_id: id,
                qty: 1,
            }],
            1000,
        )
        .await
        .unwrap_err();
        assert!(err.to_string().contains("ปิดยอด"));
    }

    #[tokio::test]
    async fn void_restores_stock_and_excludes_from_totals() {
        let pool = connect_memory_pool().await.unwrap();
        let id = seed_product(&pool, 10).await;
        let sale = checkout_inner(
            &pool,
            vec![CheckoutLine {
                product_id: id,
                qty: 4,
            }],
            5000,
        )
        .await
        .unwrap();
        void_sale_inner(&pool, sale.id).await.unwrap();
        let stock: i64 = sqlx::query_scalar("SELECT stock_qty FROM products WHERE id = ?1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(stock, 10);
        let report = get_today_report_inner(&pool).await.unwrap();
        assert_eq!(report.sale_count, 0);
        assert_eq!(report.total_satang, 0);
    }

    #[tokio::test]
    async fn adjust_stock_sets_absolute_qty() {
        let pool = connect_memory_pool().await.unwrap();
        let id = seed_product(&pool, 5).await;
        adjust_stock_inner(&pool, id, 3, None).await.unwrap();
        let stock: i64 = sqlx::query_scalar("SELECT stock_qty FROM products WHERE id = ?1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(stock, 3);
    }

    #[tokio::test]
    async fn delete_product_removes_row_and_movements() {
        let pool = connect_memory_pool().await.unwrap();
        let id = seed_product(&pool, 4).await;
        delete_product_inner(&pool, id).await.unwrap();
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM products WHERE id = ?1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 0);
        let moves: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM stock_movements WHERE product_id = ?1",
        )
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(moves, 0);
    }

    #[tokio::test]
    async fn delete_product_rejects_when_sold_before() {
        let pool = connect_memory_pool().await.unwrap();
        let id = seed_product(&pool, 5).await;
        checkout_inner(
            &pool,
            vec![CheckoutLine {
                product_id: id,
                qty: 1,
            }],
            5000,
        )
        .await
        .unwrap();
        let err = delete_product_inner(&pool, id).await.unwrap_err();
        assert!(err.to_string().contains("ขาย"));
    }

    #[tokio::test]
    async fn day_bounds_cover_full_bangkok_day() {
        let (start, end) = day_bounds_iso("2026-10-02").unwrap();
        assert!(start.contains("2026-10-02"));
        assert!(start.contains("+07:00") || start.contains("+07"));
        assert!(end.starts_with("2026-10-03") || end.contains("2026-10-03"));
    }

    #[tokio::test]
    async fn list_products_page_returns_slice_and_total() {
        let pool = connect_memory_pool().await.unwrap();
        for i in 0..3 {
            create_product_inner(
                &pool,
                CreateProductInput {
                    name: format!("สินค้า{i}"),
                    barcode: None,
                    price_satang: 1000,
                    stock_qty: 1,
                    low_stock_qty: 0,
                    active: true,
                },
            )
            .await
            .unwrap();
        }
        let page = list_products_page_inner(&pool, None, true, 2, 0)
            .await
            .unwrap();
        assert_eq!(page.total, 3);
        assert_eq!(page.items.len(), 2);
        assert_eq!(page.limit, 2);
        assert_eq!(page.offset, 0);

        let page2 = list_products_page_inner(&pool, None, true, 2, 2)
            .await
            .unwrap();
        assert_eq!(page2.items.len(), 1);
        assert_ne!(page.items[0].id, page2.items[0].id);
    }

    #[tokio::test]
    async fn low_stock_count_uses_index_friendly_query() {
        let pool = connect_memory_pool().await.unwrap();
        create_product_inner(
            &pool,
            CreateProductInput {
                name: "ต่ำ".into(),
                barcode: None,
                price_satang: 1000,
                stock_qty: 1,
                low_stock_qty: 5,
                active: true,
            },
        )
        .await
        .unwrap();
        create_product_inner(
            &pool,
            CreateProductInput {
                name: "ปกติ".into(),
                barcode: None,
                price_satang: 1000,
                stock_qty: 50,
                low_stock_qty: 5,
                active: true,
            },
        )
        .await
        .unwrap();
        let count = get_low_stock_count_inner(&pool).await.unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn import_products_creates_and_updates_by_barcode() {
        use crate::commands::import_products_inner;
        let pool = connect_memory_pool().await.unwrap();
        let first = import_products_inner(
            &pool,
            vec![CreateProductInput {
                name: "น้ำ".into(),
                barcode: Some("B1".into()),
                price_satang: 1000,
                stock_qty: 5,
                low_stock_qty: 2,
                active: true,
            }],
        )
        .await
        .unwrap();
        assert_eq!(first.created, 1);
        assert_eq!(first.updated, 0);

        let second = import_products_inner(
            &pool,
            vec![CreateProductInput {
                name: "น้ำอัพเดต".into(),
                barcode: Some("B1".into()),
                price_satang: 1500,
                stock_qty: 99,
                low_stock_qty: 3,
                active: true,
            }],
        )
        .await
        .unwrap();
        assert_eq!(second.created, 0);
        assert_eq!(second.updated, 1);

        let (name, price, stock): (String, i64, i64) = sqlx::query_as(
            "SELECT name, price_satang, stock_qty FROM products WHERE barcode = 'B1'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(name, "น้ำอัพเดต");
        assert_eq!(price, 1500);
        assert_eq!(stock, 5); // stock unchanged on update
    }
}
