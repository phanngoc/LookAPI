use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "lastScanned")]
    pub last_scanned: Option<i64>,
    #[serde(rename = "baseUrl")]
    pub base_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiEndpoint {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: Option<String>,
    pub name: String,
    pub method: String,
    pub path: String,
    pub service: String,
    pub description: String,
    pub parameters: Vec<ApiParameter>,
    pub category: String,
    pub explanation: Option<String>,
    pub responses: Option<Vec<ApiResponseDefinition>>,
}

/// Response definition for API documentation (stored in database)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiResponseDefinition {
    #[serde(rename = "statusCode")]
    pub status_code: u16,
    pub description: String,
    #[serde(rename = "contentType")]
    pub content_type: String,
    pub schema: Option<serde_json::Value>, // JSON schema
    pub example: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiParameter {
    pub name: String,
    #[serde(rename = "type")]
    pub param_type: String,
    pub required: bool,
    pub description: String,
    pub example: Option<serde_json::Value>,
    #[serde(rename = "defaultValue")]
    pub default_value: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiRequest {
    pub endpoint: String,
    pub method: String,
    pub parameters: serde_json::Value,
    pub headers: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiResponse {
    pub status: u16,
    #[serde(rename = "statusText")]
    pub status_text: String,
    pub data: serde_json::Value,
    pub headers: std::collections::HashMap<String, String>,
    pub duration: u128,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestSuite {
    pub id: String,
    pub name: String,
    pub description: String,
    pub endpoints: Vec<String>,
    pub category: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub row_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct YamlFile {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "scenarioId")]
    pub scenario_id: Option<String>,
    pub content: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateYamlWithAIResponse {
    pub yaml: String,
    pub scenario: Option<crate::scenario::types::TestScenario>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequestTab {
    pub id: String,
    #[serde(rename = "endpoint")]
    pub endpoint: Option<ApiEndpoint>, // null for empty/custom requests
    pub method: String,
    pub url: String,
    #[serde(rename = "bodyJson")]
    pub body_json: String,
    #[serde(rename = "headersJson")]
    pub headers_json: String,
    #[serde(rename = "response", skip_serializing_if = "Option::is_none")]
    pub response: Option<ApiResponse>, // Runtime state, not persisted
    #[serde(rename = "error", skip_serializing_if = "Option::is_none")]
    pub error: Option<String>, // Runtime state, not persisted
    #[serde(rename = "isExecuting", skip_serializing_if = "Option::is_none")]
    pub is_executing: Option<bool>, // Runtime state, not persisted
    #[serde(rename = "activeTab")]
    pub active_tab: String, // 'body' | 'headers' | 'response-schema'
    pub name: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(rename = "curlCommand", skip_serializing_if = "Option::is_none")]
    pub curl_command: Option<String>, // Runtime state, not persisted
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequestTabState {
    pub tabs: Vec<RequestTab>,
    #[serde(rename = "activeTabId")]
    pub active_tab_id: Option<String>,
}
