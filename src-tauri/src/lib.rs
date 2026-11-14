mod commands;
mod db;
#[cfg(test)]
mod db_tests;
mod error;
mod models;
mod timeutil;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let pool = db::init_db(&handle).await.map_err(|e| e.to_string())?;
                handle.manage(pool);
                Ok::<(), String>(())
            })?;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_fullscreen(true);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_products,
            commands::list_products_page,
            commands::get_low_stock_count,
            commands::get_products_by_ids,
            commands::get_product_by_barcode,
            commands::create_product,
            commands::import_products,
            commands::update_product,
            commands::delete_product,
            commands::set_product_pinned,
            commands::receive_stock,
            commands::adjust_stock,
            commands::list_stock_movements,
            commands::checkout,
            commands::get_today_report,
            commands::get_sale,
            commands::close_day,
            commands::list_day_closes,
            commands::void_sale,
            commands::backup_database,
            commands::get_data_dir,
            commands::get_shop_settings,
            commands::set_shop_settings,
            commands::export_products_csv,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
