pub mod commands;
pub mod database;
pub mod http_client;
pub mod scanner;
pub mod scenario;
pub mod security;
pub mod types;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logger
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("debug")).init();
    
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
            commands::update_project_base_url,
            commands::get_endpoints_by_project,
            // Security testing commands
            commands::create_security_test_case,
            commands::get_security_test_cases,
            commands::delete_security_test_case,
            commands::run_security_test,
            commands::get_security_test_runs,
            // Test scenario commands
            commands::create_test_scenario,
            commands::get_test_scenarios,
            commands::get_test_scenario,
            commands::update_test_scenario,
            commands::delete_test_scenario,
            commands::add_test_scenario_step,
            commands::get_test_scenario_steps,
            commands::update_test_scenario_step,
            commands::delete_test_scenario_step,
            commands::reorder_test_scenario_steps,
            commands::run_test_scenario,
            commands::get_test_scenario_runs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
