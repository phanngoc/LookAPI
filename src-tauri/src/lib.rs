pub mod commands;
pub mod database;
pub mod http_client;
pub mod scanner;
pub mod types;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database
    database::init_database().expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::execute_http_request,
            commands::generate_curl_command,
            commands::get_all_endpoints,
            commands::save_endpoint,
            commands::get_all_test_suites,
            commands::execute_sql_query,
            commands::export_response,
            commands::scan_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
