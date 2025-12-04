use crate::{database, http_client, scanner, scenario, security, types::*};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

#[tauri::command]
pub async fn execute_http_request(request: ApiRequest) -> Result<ApiResponse, String> {
    http_client::execute_request(request)
}

#[tauri::command]
pub async fn generate_curl_command(
    url: String,
    method: String,
    body: Option<serde_json::Value>
) -> Result<String, String> {
    Ok(http_client::generate_curl(&url, &method, body.as_ref()))
}

#[tauri::command]
pub async fn get_all_endpoints() -> Result<Vec<ApiEndpoint>, String> {
    database::get_all_endpoints()
}

#[tauri::command]
pub async fn save_endpoint(endpoint: ApiEndpoint) -> Result<(), String> {
    database::save_endpoint(endpoint)
}

#[tauri::command]
pub async fn get_all_test_suites() -> Result<Vec<TestSuite>, String> {
    database::get_all_test_suites()
}

#[tauri::command]
pub async fn execute_sql_query(db_path: String, query: String) -> Result<QueryResult, String> {
    database::execute_sql_query(db_path, query)
}

#[tauri::command]
pub async fn export_response(filename: String, content: String) -> Result<String, String> {
    use std::fs;
    let downloads = dirs::download_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    let path = downloads.join(filename);

    fs::write(&path, content)
        .map_err(|e| format!("Failed to save file: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

// Project management commands
#[tauri::command]
pub async fn open_folder_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    
    app.dialog()
        .file()
        .pick_folder(move |folder_path| {
            let _ = tx.send(folder_path.map(|p| p.to_string()));
        });
    
    rx.recv()
        .map_err(|e| format!("Failed to receive folder path: {}", e))
}

#[tauri::command]
pub async fn create_project(path: String) -> Result<Project, String> {
    let path_buf = PathBuf::from(&path);
    
    // Extract project name from path
    let name = path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unnamed Project")
        .to_string();
    
    let project = Project {
        id: Uuid::new_v4().to_string(),
        name,
        path,
        created_at: chrono::Utc::now().timestamp(),
        last_scanned: None,
    };
    
    database::save_project(project.clone())
        .map_err(|e| format!("Failed to save project: {}", e))?;
    
    Ok(project)
}

#[tauri::command]
pub async fn get_all_projects() -> Result<Vec<Project>, String> {
    database::get_all_projects()
}

#[tauri::command]
pub async fn delete_project(project_id: String) -> Result<(), String> {
    database::delete_project(project_id)
}

#[tauri::command]
pub async fn get_endpoints_by_project(project_id: String) -> Result<Vec<ApiEndpoint>, String> {
    database::get_endpoints_by_project(project_id)
}

#[tauri::command]
pub async fn scan_project(project_id: String, project_path: String) -> Result<Vec<ApiEndpoint>, String> {
    let path = PathBuf::from(&project_path);
    
    // Clear existing endpoints for this project before scanning
    database::clear_project_endpoints(&project_id)
        .map_err(|e| format!("Failed to clear old endpoints: {}", e))?;
    
    // Perform scan
    let scanner = scanner::UnifiedScanner::new(path.clone());
    let scan_result = scanner.scan().await
        .map_err(|e| format!("Scan failed: {}", e))?;

    // Convert ScannedEndpoint to ApiEndpoint
    let service_detector = scanner::ServiceDetector::new(
        path.clone(),
        Some(scan_result.framework_info.clone()),
    );

    let mut api_endpoints = Vec::new();
    
    for scanned_endpoint in scan_result.endpoints {
        let file_path = PathBuf::from(&scanned_endpoint.file_path);
        let service = service_detector.detect_service_from_path(&file_path);
        
        // Generate ID from project_id, method and path
        let id = format!("{}-{}-{}", 
            project_id,
            scanned_endpoint.method.to_uppercase(),
            scanned_endpoint.path.replace('/', "-").replace('{', "").replace('}', "")
        );
        
        // Convert parameters
        let parameters: Vec<ApiParameter> = scanned_endpoint.parameters
            .into_iter()
            .map(|p| ApiParameter {
                name: p.name,
                param_type: p.param_type,
                required: p.required,
                description: String::new(),
                example: p.example,
                default_value: p.default_value,
            })
            .collect();

        // Generate category from path
        let category = scanned_endpoint.path
            .split('/')
            .filter(|s| !s.is_empty())
            .next()
            .unwrap_or("api")
            .to_string();

        let api_endpoint = ApiEndpoint {
            id,
            project_id: Some(project_id.clone()),
            name: format!("{} {}", scanned_endpoint.method, scanned_endpoint.path),
            method: scanned_endpoint.method,
            path: scanned_endpoint.path,
            service,
            description: scanned_endpoint.business_logic.description,
            parameters,
            category,
            explanation: Some(scanned_endpoint.business_logic.summary),
        };

        // Save to database
        database::save_endpoint(api_endpoint.clone())
            .map_err(|e| format!("Failed to save endpoint: {}", e))?;

        api_endpoints.push(api_endpoint);
    }
    
    // Update last_scanned timestamp
    database::update_project_last_scanned(&project_id)
        .map_err(|e| format!("Failed to update project timestamp: {}", e))?;

    Ok(api_endpoints)
}

// Security testing commands
#[tauri::command]
pub async fn create_security_test_case(
    project_id: String,
    name: String,
    endpoint_id: Option<String>,
    scans: Vec<security::types::ScanConfig>,
) -> Result<security::types::SecurityTestCase, String> {
    let now = chrono::Utc::now().timestamp();
    let test_case = security::types::SecurityTestCase {
        id: Uuid::new_v4().to_string(),
        project_id,
        name,
        endpoint_id,
        scans,
        created_at: now,
        updated_at: now,
    };

    database::save_security_test_case(test_case.clone())?;
    Ok(test_case)
}

#[tauri::command]
pub async fn get_security_test_cases(
    project_id: String,
) -> Result<Vec<security::types::SecurityTestCase>, String> {
    database::get_security_test_cases_by_project(&project_id)
}

#[tauri::command]
pub async fn delete_security_test_case(id: String) -> Result<(), String> {
    database::delete_security_test_case(&id)
}

#[tauri::command]
pub async fn run_security_test(
    test_case: security::types::SecurityTestCase,
    url: String,
    method: String,
    params: HashMap<String, serde_json::Value>,
    headers: HashMap<String, String>,
) -> Result<security::types::SecurityTestRun, String> {
    let run = security::scanner::run_security_test(&test_case, &url, &method, &params, &headers);
    database::save_security_test_run(&run)?;
    Ok(run)
}

#[tauri::command]
pub async fn get_security_test_runs(
    test_case_id: String,
) -> Result<Vec<security::types::SecurityTestRun>, String> {
    database::get_security_test_runs(&test_case_id)
}

// ============================================================================
// Test Scenario Commands
// ============================================================================

#[tauri::command]
pub async fn create_test_scenario(
    project_id: String,
    name: String,
    description: Option<String>,
    priority: Option<String>,
) -> Result<scenario::types::TestScenario, String> {
    let now = chrono::Utc::now().timestamp();
    let scenario = scenario::types::TestScenario {
        id: Uuid::new_v4().to_string(),
        project_id,
        name,
        description,
        priority: priority.unwrap_or_else(|| "medium".to_string()),
        variables: serde_json::json!({}),
        pre_script: None,
        post_script: None,
        created_at: now,
        updated_at: now,
    };

    database::save_test_scenario(scenario.clone())?;
    Ok(scenario)
}

#[tauri::command]
pub async fn get_test_scenarios(
    project_id: String,
) -> Result<Vec<scenario::types::TestScenario>, String> {
    database::get_test_scenarios_by_project(&project_id)
}

#[tauri::command]
pub async fn get_test_scenario(
    scenario_id: String,
) -> Result<Option<scenario::types::TestScenario>, String> {
    database::get_test_scenario(&scenario_id)
}

#[tauri::command]
pub async fn update_test_scenario(
    request: scenario::types::UpdateScenarioRequest,
) -> Result<scenario::types::TestScenario, String> {
    let existing = database::get_test_scenario(&request.id)?
        .ok_or_else(|| "Scenario not found".to_string())?;

    let now = chrono::Utc::now().timestamp();
    let updated = scenario::types::TestScenario {
        id: existing.id,
        project_id: existing.project_id,
        name: request.name.unwrap_or(existing.name),
        description: request.description.or(existing.description),
        priority: request.priority.unwrap_or(existing.priority),
        variables: request.variables.unwrap_or(existing.variables),
        pre_script: request.pre_script.or(existing.pre_script),
        post_script: request.post_script.or(existing.post_script),
        created_at: existing.created_at,
        updated_at: now,
    };

    database::save_test_scenario(updated.clone())?;
    Ok(updated)
}

#[tauri::command]
pub async fn delete_test_scenario(scenario_id: String) -> Result<(), String> {
    database::delete_test_scenario(&scenario_id)
}

#[tauri::command]
pub async fn add_test_scenario_step(
    request: scenario::types::CreateStepRequest,
) -> Result<scenario::types::TestScenarioStep, String> {
    // Get existing steps to determine order
    let existing_steps = database::get_test_scenario_steps(&request.scenario_id)?;
    let max_order = existing_steps.iter().map(|s| s.step_order).max().unwrap_or(-1);

    let step = scenario::types::TestScenarioStep {
        id: Uuid::new_v4().to_string(),
        scenario_id: request.scenario_id,
        step_order: max_order + 1,
        step_type: request.step_type,
        name: request.name,
        config: request.config,
        enabled: true,
    };

    database::save_test_scenario_step(step.clone())?;
    Ok(step)
}

#[tauri::command]
pub async fn get_test_scenario_steps(
    scenario_id: String,
) -> Result<Vec<scenario::types::TestScenarioStep>, String> {
    database::get_test_scenario_steps(&scenario_id)
}

#[tauri::command]
pub async fn update_test_scenario_step(
    request: scenario::types::UpdateStepRequest,
) -> Result<scenario::types::TestScenarioStep, String> {
    // Need to get the step from its scenario
    let all_scenarios = database::get_test_scenarios_by_project("")?;
    let mut found_step: Option<scenario::types::TestScenarioStep> = None;
    
    for scenario in &all_scenarios {
        let steps = database::get_test_scenario_steps(&scenario.id)?;
        if let Some(step) = steps.into_iter().find(|s| s.id == request.id) {
            found_step = Some(step);
            break;
        }
    }

    let existing = found_step.ok_or_else(|| "Step not found".to_string())?;

    let updated = scenario::types::TestScenarioStep {
        id: existing.id,
        scenario_id: existing.scenario_id,
        step_order: existing.step_order,
        step_type: existing.step_type,
        name: request.name.unwrap_or(existing.name),
        config: request.config.unwrap_or(existing.config),
        enabled: request.enabled.unwrap_or(existing.enabled),
    };

    database::save_test_scenario_step(updated.clone())?;
    Ok(updated)
}

#[tauri::command]
pub async fn delete_test_scenario_step(step_id: String) -> Result<(), String> {
    database::delete_test_scenario_step(&step_id)
}

#[tauri::command]
pub async fn reorder_test_scenario_steps(
    request: scenario::types::ReorderStepsRequest,
) -> Result<(), String> {
    database::reorder_test_scenario_steps(&request.scenario_id, &request.step_ids)
}

#[tauri::command]
pub async fn run_test_scenario(
    scenario_id: String,
) -> Result<scenario::types::TestScenarioRun, String> {
    let scenario = database::get_test_scenario(&scenario_id)?
        .ok_or_else(|| "Scenario not found".to_string())?;
    
    let steps = database::get_test_scenario_steps(&scenario_id)?;
    
    let run = scenario::executor::run_scenario(&scenario, &steps);
    database::save_test_scenario_run(&run)?;
    
    Ok(run)
}

#[tauri::command]
pub async fn get_test_scenario_runs(
    scenario_id: String,
) -> Result<Vec<scenario::types::TestScenarioRun>, String> {
    database::get_test_scenario_runs(&scenario_id)
}
