use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkInfo {
    pub framework_type: String, // 'go', 'node', 'ruby', 'php', 'unknown'
    pub framework: String,      // 'nestjs', 'express', 'rails', 'laravel', 'custom', 'unknown'
    pub version: Option<String>,
    pub patterns: FrameworkPatterns,
    pub structure: FrameworkStructure,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkPatterns {
    pub routing: Vec<String>,
    pub controllers: Vec<String>,
    pub decorators: Vec<String>,
    pub middleware: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkStructure {
    pub controllers_path: Vec<String>,
    pub routes_path: Vec<String>,
    pub models_path: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannedEndpoint {
    pub path: String,
    pub method: String,
    pub controller: String,
    pub action: String,
    pub file_path: String,
    pub line_number: u32,
    pub parameters: Vec<EndpointParameter>,
    pub business_logic: BusinessLogic,
    pub authentication: Authentication,
    pub authorization: Authorization,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointParameter {
    pub name: String,
    pub param_type: String,
    pub source: String, // 'path', 'query', 'body', 'header'
    pub required: bool,
    pub validation: Option<Vec<String>>,
    pub example: Option<Value>,
    #[serde(rename = "defaultValue")]
    pub default_value: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusinessLogic {
    pub summary: String,
    pub description: String,
    pub purpose: String,
    pub dependencies: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Authentication {
    pub required: bool,
    pub auth_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Authorization {
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub framework_info: FrameworkInfo,
    pub endpoints: Vec<ScannedEndpoint>,
    pub scan_method: String,
}

impl Default for FrameworkPatterns {
    fn default() -> Self {
        Self {
            routing: vec![],
            controllers: vec![],
            decorators: vec![],
            middleware: vec![],
        }
    }
}

impl Default for FrameworkStructure {
    fn default() -> Self {
        Self {
            controllers_path: vec![],
            routes_path: vec![],
            models_path: vec![],
        }
    }
}

impl Default for BusinessLogic {
    fn default() -> Self {
        Self {
            summary: String::new(),
            description: String::new(),
            purpose: String::new(),
            dependencies: vec![],
        }
    }
}

impl Default for Authentication {
    fn default() -> Self {
        Self {
            required: false,
            auth_type: None,
        }
    }
}

impl Default for Authorization {
    fn default() -> Self {
        Self {
            roles: vec![],
            permissions: vec![],
        }
    }
}

