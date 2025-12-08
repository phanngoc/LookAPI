pub mod commands;
pub mod database;
pub mod http_client;
pub mod scanner;
pub mod scenario;
pub mod security;
pub mod types;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logger with detailed format
    env_logger::Builder::from_env(
        env_logger::Env::default()
            .default_filter_or("debug")
            .default_write_style_or("always")
    )
    .format_timestamp_secs()
    .format_module_path(true)
    .format_target(true)
    .init();
    
    log::info!("[App] Logger initialized");
    log::info!("[App] Log level: {}", std::env::var("RUST_LOG").unwrap_or_else(|_| "debug".to_string()));
    
    // Initialize database
    log::info!("[App] Initializing database");
    database::init_database().expect("Failed to initialize database");
    log::info!("[App] Database initialized successfully");

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
            // YAML export/import commands
            commands::export_scenario_yaml,
            commands::export_project_scenarios_yaml,
            commands::preview_scenario_yaml_import,
            commands::preview_project_scenarios_yaml_import,
            commands::import_scenario_yaml,
            commands::import_project_scenarios_yaml,
            commands::get_yaml_template,
            commands::generate_yaml_with_ai,
            commands::get_yaml_files,
            commands::save_yaml_file,
            commands::delete_yaml_file,
            commands::update_scenario_from_yaml,
            // CSV commands
            commands::preview_csv_file,
            // Performance testing commands
            commands::create_performance_test,
            commands::get_performance_tests,
            commands::get_performance_test,
            commands::update_performance_test,
            commands::delete_performance_test,
            commands::run_performance_test,
            commands::get_performance_test_runs,
            commands::get_performance_test_run,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
