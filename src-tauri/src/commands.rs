use crate::{database, http_client, scanner, scenario, security, types::*};
use scenario::yaml::{
    ScenarioImportPreview, ProjectImportPreview,
    parse_scenario_yaml, parse_project_scenarios_yaml,
    scenario_to_yaml_string, project_scenarios_to_yaml_string,
    yaml_to_scenario_with_steps, create_import_preview, create_project_import_preview,
    generate_yaml_template, generate_yaml_template_with_ai,
};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

#[tauri::command]
pub async fn execute_http_request(request: ApiRequest) -> Result<ApiResponse, String> {
    log::info!("[Command] execute_http_request called: {} {}", request.method, request.endpoint);
    log::debug!("[Command] Request details: method={}, endpoint={}, has_headers={}, has_params={}", 
        request.method, 
        request.endpoint,
        request.headers.is_some(),
        !request.parameters.is_null());
    
    let start = std::time::Instant::now();
    
    // Wrap blocking HTTP client in spawn_blocking to avoid tokio runtime conflicts
    // Blocking client needs to be created and dropped in blocking thread pool
    log::debug!("[Command] Spawning blocking task for HTTP request");
    let result = tauri::async_runtime::spawn_blocking(move || {
        log::info!("[Command] Blocking task started for HTTP request");
        http_client::execute_request(request)
    })
    .await
    .map_err(|e| {
        let error = format!("Failed to execute request in blocking thread: {}", e);
        log::error!("[Command] Async runtime error: {}", error);
        error
    })?;
    
    let duration = start.elapsed();
    match &result {
        Ok(response) => {
            log::info!("[Command] Request completed successfully: status={}, duration={}ms", 
                response.status, duration.as_millis());
        },
        Err(e) => {
            log::error!("[Command] Request failed after {}ms: {}", duration.as_millis(), e);
        }
    }
    
    result
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
        base_url: None,
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
pub async fn update_project_base_url(project_id: String, base_url: Option<String>) -> Result<(), String> {
    database::update_project_base_url(&project_id, base_url)
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

        // Convert responses
        let responses: Vec<ApiResponseDefinition> = scanned_endpoint.responses
            .into_iter()
            .map(|r| ApiResponseDefinition {
                status_code: r.status_code,
                description: r.description,
                content_type: r.content_type,
                schema: r.schema.map(|s| serde_json::to_value(&s).unwrap_or_default()),
                example: r.example,
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
            responses: Some(responses),
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
    // Get the step directly by ID
    let existing = database::get_test_scenario_step_by_id(&request.id)?
        .ok_or_else(|| "Step not found".to_string())?;

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
    app: tauri::AppHandle,
    scenario_id: String,
) -> Result<scenario::types::TestScenarioRun, String> {
    log::info!("[Command] run_test_scenario called for scenario_id: {}", scenario_id);
    
    let scenario = database::get_test_scenario(&scenario_id)?
        .ok_or_else(|| {
            let error = format!("Scenario not found: {}", scenario_id);
            log::error!("[Command] {}", error);
            error
        })?;
    
    log::info!("[Command] Scenario found: {} ({} steps)", scenario.name, scenario_id);
    
    let steps = database::get_test_scenario_steps(&scenario_id)?;
    log::info!("[Command] Loaded {} steps for scenario", steps.len());
    
    // Get project to retrieve base_url
    let project = database::get_project(&scenario.project_id)?
        .ok_or_else(|| {
            let error = format!("Project not found: {}", scenario.project_id);
            log::error!("[Command] {}", error);
            error
        })?;
    
    let base_url = project.base_url.clone();
    log::info!("[Command] Project base URL: {:?}", base_url);
    
    // Run scenario in a spawned task to avoid blocking
    log::info!("[Command] Spawning blocking task to execute scenario");
    let app_clone = app.clone();
    let scenario_clone = scenario.clone();
    let steps_clone = steps.clone();
    
    let start = std::time::Instant::now();
    let run = tauri::async_runtime::spawn_blocking(move || {
        log::info!("[Command] Blocking task started for scenario: {}", scenario_clone.name);
        scenario::executor::run_scenario(&scenario_clone, &steps_clone, Some(&app_clone), base_url)
    })
    .await
    .map_err(|e| {
        let error = format!("Failed to execute scenario: {}", e);
        log::error!("[Command] Async runtime error: {}", error);
        log::error!("[Command] Error details: {:?}", e);
        error
    })?;
    
    let duration = start.elapsed();
    log::info!("[Command] Scenario execution completed in {}ms", duration.as_millis());
    log::info!("[Command] Scenario result: status={:?}, passed={}/{}", 
        run.status, run.passed_steps, run.total_steps);
    
    database::save_test_scenario_run(&run)
        .map_err(|e| {
            let error = format!("Failed to save scenario run: {}", e);
            log::error!("[Command] {}", error);
            error
        })?;
    
    log::info!("[Command] Scenario run saved to database");
    
    Ok(run)
}

#[tauri::command]
pub async fn get_test_scenario_runs(
    scenario_id: String,
) -> Result<Vec<scenario::types::TestScenarioRun>, String> {
    database::get_test_scenario_runs(&scenario_id)
}

// ============================================================================
// YAML Export/Import Commands
// ============================================================================

/// Export a single scenario to YAML string
#[tauri::command]
pub async fn export_scenario_yaml(
    scenario_id: String,
    base_url: Option<String>,
) -> Result<String, String> {
    let scenario = database::get_test_scenario(&scenario_id)?
        .ok_or_else(|| "Scenario not found".to_string())?;
    let steps = database::get_test_scenario_steps(&scenario_id)?;
    
    scenario_to_yaml_string(&scenario, &steps, base_url)
}

/// Export all scenarios in a project to YAML string
#[tauri::command]
pub async fn export_project_scenarios_yaml(
    project_id: String,
) -> Result<String, String> {
    // Get project info
    let project = database::get_project(&project_id)?
        .ok_or_else(|| "Project not found".to_string())?;
    
    // Get all scenarios for the project
    let scenarios = database::get_test_scenarios_by_project(&project_id)?;
    
    // Get steps for each scenario
    let mut scenarios_with_steps = Vec::new();
    for scenario in &scenarios {
        let steps = database::get_test_scenario_steps(&scenario.id)?;
        scenarios_with_steps.push((scenario, steps));
    }
    
    // Convert to references for the function
    let scenarios_refs: Vec<(&scenario::types::TestScenario, &[scenario::types::TestScenarioStep])> = 
        scenarios_with_steps.iter()
            .map(|(s, steps)| (*s, steps.as_slice()))
            .collect();
    
    project_scenarios_to_yaml_string(&project.name, project.base_url, scenarios_refs)
}

/// Preview a scenario import from YAML (dry run)
#[tauri::command]
pub async fn preview_scenario_yaml_import(
    yaml_content: String,
) -> Result<ScenarioImportPreview, String> {
    let yaml = parse_scenario_yaml(&yaml_content)?;
    Ok(create_import_preview(&yaml))
}

/// Preview a project scenarios import from YAML (dry run)
#[tauri::command]
pub async fn preview_project_scenarios_yaml_import(
    yaml_content: String,
) -> Result<ProjectImportPreview, String> {
    let yaml = parse_project_scenarios_yaml(&yaml_content)?;
    Ok(create_project_import_preview(&yaml))
}

/// Import a single scenario from YAML
#[tauri::command]
pub async fn import_scenario_yaml(
    project_id: String,
    yaml_content: String,
) -> Result<scenario::types::TestScenario, String> {
    let yaml = parse_scenario_yaml(&yaml_content)?;
    let (scenario, steps) = yaml_to_scenario_with_steps(&yaml, &project_id);
    
    // Save scenario
    database::save_test_scenario(scenario.clone())?;
    
    // Save steps
    for step in steps {
        database::save_test_scenario_step(step)?;
    }
    
    Ok(scenario)
}

/// Import multiple scenarios from project YAML
#[tauri::command]
pub async fn import_project_scenarios_yaml(
    project_id: String,
    yaml_content: String,
) -> Result<Vec<scenario::types::TestScenario>, String> {
    let yaml = parse_project_scenarios_yaml(&yaml_content)?;
    let mut imported_scenarios = Vec::new();
    
    for scenario_yaml in &yaml.scenarios {
        let (scenario, steps) = yaml_to_scenario_with_steps(scenario_yaml, &project_id);
        
        // Save scenario
        database::save_test_scenario(scenario.clone())?;
        
        // Save steps
        for step in steps {
            database::save_test_scenario_step(step)?;
        }
        
        imported_scenarios.push(scenario);
    }
    
    Ok(imported_scenarios)
}

/// Get YAML template for AI tools
#[tauri::command]
pub async fn get_yaml_template() -> Result<String, String> {
    Ok(generate_yaml_template())
}

/// Generate YAML template using AI (Copilot CLI)
/// 
/// This command uses Copilot CLI to generate a test scenario YAML template
/// based on the project context and user prompt.
#[tauri::command]
pub async fn generate_yaml_with_ai(
    project_path: String,
    user_prompt: String,
    project_id: Option<String>,
    base_url: Option<String>,
) -> Result<GenerateYamlWithAIResponse, String> {
    log::info!("[Command] generate_yaml_with_ai called for project: {}", project_path);
    
    // Get endpoints if project_id is provided
    let endpoints = match &project_id {
        Some(id) => {
            match database::get_endpoints_by_project(id.clone()) {
                Ok(eps) => Some(eps),
                Err(e) => {
                    log::warn!("Failed to get endpoints for project {}: {}", id, e);
                    None
                }
            }
        }
        None => None
    };
    
    // Generate YAML using AI
    let result = generate_yaml_template_with_ai(
        &project_path,
        &user_prompt,
        endpoints.as_deref(),
        base_url.as_deref(),
    ).await;
    
    match result {
        Ok(yaml) => {
            log::info!("[Command] AI generation successful");
            
            let mut created_scenario = None;
            
            // Save generated YAML to database if project_id is provided
            if let Some(ref pid) = project_id {
                let yaml_file = YamlFile {
                    id: Uuid::new_v4().to_string(),
                    project_id: pid.clone(),
                    scenario_id: None,
                    content: yaml.clone(),
                    created_at: chrono::Utc::now().timestamp(),
                };
                
                if let Err(e) = database::save_yaml_file(yaml_file) {
                    log::warn!("[Command] Failed to save YAML to database: {}", e);
                } else {
                    log::info!("[Command] YAML saved to database successfully");
                }
                
                // Auto-import as test scenario
                log::info!("[Command] Auto-importing generated YAML as test scenario");
                match parse_scenario_yaml(&yaml) {
                    Ok(parsed_yaml) => {
                        let (scenario, steps) = yaml_to_scenario_with_steps(&parsed_yaml, pid);
                        
                        // Save scenario
                        match database::save_test_scenario(scenario.clone()) {
                            Ok(_) => {
                                log::info!("[Command] Test scenario saved: {} ({})", scenario.name, scenario.id);
                                
                                // Save steps
                                let mut steps_saved = 0;
                                for step in steps {
                                    if let Ok(_) = database::save_test_scenario_step(step) {
                                        steps_saved += 1;
                                    }
                                }
                                log::info!("[Command] {} steps saved for scenario {}", steps_saved, scenario.id);
                                
                                created_scenario = Some(scenario);
                            }
                            Err(e) => {
                                log::warn!("[Command] Failed to save auto-imported scenario: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        log::warn!("[Command] Failed to parse generated YAML for auto-import: {}", e);
                    }
                }
            }
            
            Ok(GenerateYamlWithAIResponse {
                yaml,
                scenario: created_scenario,
            })
        }
        Err(e) => {
            log::error!("[Command] AI generation failed: {}", e);
            Err(e)
        }
    }
}

/// Get all YAML files for a project
#[tauri::command]
pub async fn get_yaml_files(project_id: String) -> Result<Vec<YamlFile>, String> {
    database::get_yaml_files_by_project(&project_id)
}

/// Save a YAML file
#[tauri::command]
pub async fn save_yaml_file(
    project_id: String,
    content: String,
    scenario_id: Option<String>,
) -> Result<YamlFile, String> {
    log::info!("[Command] save_yaml_file called - project_id: {}, scenario_id: {:?}, content_length: {}", 
        project_id, scenario_id, content.len());
    
    let yaml_file = YamlFile {
        id: Uuid::new_v4().to_string(),
        project_id: project_id.clone(),
        scenario_id: scenario_id.clone(),
        content: content.clone(),
        created_at: chrono::Utc::now().timestamp(),
    };
    
    match database::save_yaml_file(yaml_file.clone()) {
        Ok(_) => {
            log::info!("[Command] YAML file saved successfully - id: {}, project_id: {}", 
                yaml_file.id, yaml_file.project_id);
            Ok(yaml_file)
        }
        Err(e) => {
            log::error!("[Command] Failed to save YAML file - project_id: {}, error: {}", 
                project_id, e);
            Err(e)
        }
    }
}

/// Delete a YAML file
#[tauri::command]
pub async fn delete_yaml_file(id: String) -> Result<(), String> {
    database::delete_yaml_file(&id)
}

/// Update an existing scenario from YAML content
#[tauri::command]
pub async fn update_scenario_from_yaml(
    scenario_id: String,
    yaml_content: String,
) -> Result<scenario::types::TestScenario, String> {
    log::info!("[Command] update_scenario_from_yaml called - scenario_id: {}, content_length: {}", 
        scenario_id, yaml_content.len());
    
    // 1. Verify scenario exists
    let existing_scenario = database::get_test_scenario(&scenario_id)?
        .ok_or_else(|| format!("Scenario not found: {}", scenario_id))?;
    
    log::info!("[Command] Found existing scenario: {} (project_id: {})", 
        existing_scenario.name, existing_scenario.project_id);
    
    // 2. Parse YAML
    let yaml = parse_scenario_yaml(&yaml_content)?;
    
    // 3. Delete old steps
    let old_steps = database::get_test_scenario_steps(&scenario_id)?;
    log::info!("[Command] Deleting {} old steps", old_steps.len());
    for step in old_steps {
        database::delete_test_scenario_step(&step.id)?;
    }
    
    // 4. Update scenario with YAML data (keep existing ID, project_id, created_at)
    let now = chrono::Utc::now().timestamp();
    let updated_scenario = scenario::types::TestScenario {
        id: existing_scenario.id.clone(),
        project_id: existing_scenario.project_id.clone(),
        name: yaml.name.clone(),
        description: yaml.description.clone(),
        priority: yaml.priority.clone(),
        variables: serde_json::to_value(&yaml.variables).unwrap_or(serde_json::json!({})),
        pre_script: yaml.pre_script.clone(),
        post_script: yaml.post_script.clone(),
        created_at: existing_scenario.created_at,
        updated_at: now,
    };
    
    database::save_test_scenario(updated_scenario.clone())?;
    log::info!("[Command] Scenario updated: {}", updated_scenario.name);
    
    // 5. Create new steps from YAML
    let new_steps: Vec<scenario::types::TestScenarioStep> = yaml
        .steps
        .iter()
        .enumerate()
        .map(|(i, step_yaml)| scenario::yaml::yaml_to_step(step_yaml, &scenario_id, i as i32))
        .collect();
    
    log::info!("[Command] Creating {} new steps", new_steps.len());
    for step in new_steps {
        database::save_test_scenario_step(step)?;
    }
    
    log::info!("[Command] Scenario updated successfully - id: {}, steps_count: {}", 
        updated_scenario.id, yaml.steps.len());
    
    Ok(updated_scenario)
}

/// Preview CSV file for UI display
#[tauri::command]
pub async fn preview_csv_file(
    file_path: String,
    quote_char: Option<String>,
    delimiter: Option<String>,
) -> Result<scenario::types::CsvPreview, String> {
    log::info!("[Command] preview_csv_file called: {}", file_path);
    
    let csv_config = scenario::types::CsvConfig {
        file_name: file_path.clone(),
        quote_char: quote_char.and_then(|s| s.chars().next()),
        delimiter: delimiter.and_then(|s| s.chars().next()),
    };
    
    scenario::csv_reader::preview_csv_file(&file_path, &csv_config, 10)
        .map_err(|e| format!("Failed to preview CSV: {}", e))
}
