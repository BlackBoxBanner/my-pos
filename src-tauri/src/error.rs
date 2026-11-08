use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Message(String),
    #[error(transparent)]
    Sqlx(#[from] sqlx::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    pub fn msg(message: impl Into<String>) -> Self {
        Self::Message(message.into())
    }

    /// Map common SQLite constraint failures to Thai UX messages.
    pub fn from_sqlx(err: sqlx::Error) -> Self {
        if let sqlx::Error::Database(db_err) = &err {
            let msg = db_err.message();
            let lower = msg.to_lowercase();
            if lower.contains("unique") && lower.contains("barcode") {
                return Self::msg("บาร์โค้ดซ้ำกับสินค้าอื่น");
            }
            if lower.contains("unique") && lower.contains("receipt") {
                return Self::msg("เลขที่ใบเสร็จซ้ำ กรุณาลองอีกครั้ง");
            }
            if lower.contains("unique") {
                return Self::msg("ข้อมูลซ้ำกับรายการที่มีอยู่");
            }
            if lower.contains("check") && lower.contains("stock") {
                return Self::msg("จำนวนสต็อกไม่ถูกต้อง");
            }
            if lower.contains("constraint failed") || lower.contains("check constraint") {
                return Self::msg("ข้อมูลไม่ผ่านเงื่อนไขของระบบ");
            }
        }
        Self::Sqlx(err)
    }
}

/// Convert sqlx Result into AppResult with Thai mapping for constraints.
pub fn map_sqlx<T>(result: Result<T, sqlx::Error>) -> AppResult<T> {
    result.map_err(AppError::from_sqlx)
}
