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
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::execute_http_request,
            commands::generate_curl_command,
            commands::get_all_endpoints,
            commands::save_endpoint,
            commands::get_all_test_suites,
            commands::execute_sql_query,
            commands::export_response,
            commands::scan_project,
            // Project management commands
            commands::open_folder_dialog,
            commands::create_project,
            commands::get_all_projects,
            commands::delete_project,
            commands::get_endpoints_by_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
