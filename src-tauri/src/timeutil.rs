use chrono::{DateTime, FixedOffset, NaiveDate, Utc};

const BANGKOK_OFFSET_SECS: i32 = 7 * 3600;

pub fn bangkok_offset() -> FixedOffset {
    FixedOffset::east_opt(BANGKOK_OFFSET_SECS).expect("valid Bangkok offset")
}

pub fn now_bangkok() -> DateTime<FixedOffset> {
    Utc::now().with_timezone(&bangkok_offset())
}

pub fn now_iso() -> String {
    now_bangkok().to_rfc3339()
}

pub fn today_business_date() -> String {
    now_bangkok().format("%Y-%m-%d").to_string()
}

pub fn day_bounds_iso(business_date: &str) -> Result<(String, String), String> {
    let date = NaiveDate::parse_from_str(business_date, "%Y-%m-%d")
        .map_err(|_| format!("วันที่ไม่ถูกต้อง: {business_date}"))?;
    let offset = bangkok_offset();
    let start = date
        .and_hms_opt(0, 0, 0)
        .ok_or_else(|| "ไม่สามารถสร้างเวลาเริ่มวันได้".to_string())?
        .and_local_timezone(offset)
        .single()
        .ok_or_else(|| "ไม่สามารถแปลงเวลาเริ่มวันได้".to_string())?;
    // Exclusive end: start of next calendar day in Bangkok
    let next = (date + chrono::Duration::days(1))
        .and_hms_opt(0, 0, 0)
        .ok_or_else(|| "ไม่สามารถสร้างวันถัดไปได้".to_string())?
        .and_local_timezone(offset)
        .single()
        .ok_or_else(|| "ไม่สามารถแปลงวันถัดไปได้".to_string())?;
    Ok((start.to_rfc3339(), next.to_rfc3339()))
}
