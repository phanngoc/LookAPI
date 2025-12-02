use crate::{database, http_client, scanner, types::*};
use std::path::PathBuf;

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

#[tauri::command]
pub async fn scan_project(project_path: String) -> Result<Vec<ApiEndpoint>, String> {
    let path = PathBuf::from(&project_path);
    
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
        
        // Generate ID from method and path
        let id = format!("{}-{}", 
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
                example: None,
                default_value: None,
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

    Ok(api_endpoints)
}
