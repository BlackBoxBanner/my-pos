use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    pub id: i64,
    pub name: String,
    pub barcode: Option<String>,
    pub price_satang: i64,
    pub stock_qty: i64,
    pub low_stock_qty: i64,
    pub active: bool,
    pub pinned: bool,
    pub pin_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductPage {
    pub items: Vec<Product>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductInput {
    pub name: String,
    pub barcode: Option<String>,
    pub price_satang: i64,
    pub stock_qty: i64,
    pub low_stock_qty: i64,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProductInput {
    pub name: String,
    pub barcode: Option<String>,
    pub price_satang: i64,
    pub low_stock_qty: i64,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct StockMovement {
    pub id: i64,
    pub product_id: i64,
    pub product_name: String,
    pub qty_delta: i64,
    pub reason: String,
    pub note: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckoutLine {
    pub product_id: i64,
    pub qty: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SaleItem {
    pub id: i64,
    pub sale_id: i64,
    pub product_id: i64,
    pub name: String,
    pub qty: i64,
    pub unit_price_satang: i64,
    pub line_total_satang: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sale {
    pub id: i64,
    pub receipt_no: String,
    pub total_satang: i64,
    pub paid_satang: i64,
    pub change_satang: i64,
    pub created_at: String,
    pub status: String,
    pub voided_at: Option<String>,
    pub items: Vec<SaleItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SaleSummary {
    pub id: i64,
    pub receipt_no: String,
    pub total_satang: i64,
    pub paid_satang: i64,
    pub change_satang: i64,
    pub created_at: String,
    pub status: String,
    pub voided_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayReport {
    pub business_date: String,
    pub sale_count: i64,
    pub total_satang: i64,
    pub day_closed: bool,
    pub sales: Vec<SaleSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DayClose {
    pub id: i64,
    pub business_date: String,
    pub sale_count: i64,
    pub total_satang: i64,
    pub closed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProductsResult {
    pub created: i64,
    pub updated: i64,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopSettings {
    pub shop_name: String,
    pub shop_address: String,
    pub auto_print: bool,
    pub sound_enabled: bool,
    pub onboarding_done: bool,
}

impl Default for ShopSettings {
    fn default() -> Self {
        Self {
            shop_name: "My POS".into(),
            shop_address: String::new(),
            auto_print: false,
            sound_enabled: false,
            onboarding_done: false,
        }
    }
}
