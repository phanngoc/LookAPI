//! YAML serialization and deserialization for test scenarios
//! 
//! This module provides functionality to export/import test scenarios as YAML files,
//! making it easy for AI tools (like Copilot) to generate test scenarios.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tokio::process::Command;
use super::types::*;
use crate::types::{ApiEndpoint, ApiResponseDefinition};
use crate::scanner::types::{ResponseSchema, ResponseProperty};

/// YAML format for a single test scenario
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScenarioYaml {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default = "default_priority")]
    pub priority: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "baseUrl")]
    pub base_url: Option<String>,
    #[serde(default)]
    pub variables: HashMap<String, serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "preScript")]
    pub pre_script: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "postScript")]
    pub post_script: Option<String>,
    #[serde(default)]
    pub steps: Vec<StepYaml>,
}

fn default_priority() -> String {
    "medium".to_string()
}

/// YAML format for a project export (multiple scenarios)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectScenariosYaml {
    #[serde(rename = "projectName")]
    pub project_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "baseUrl")]
    pub base_url: Option<String>,
    #[serde(rename = "exportedAt")]
    pub exported_at: String,
    pub scenarios: Vec<ScenarioYaml>,
}

/// YAML format for a test step
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StepYaml {
    pub name: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request: Option<RequestYaml>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delay: Option<DelayYaml>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub script: Option<ScriptYaml>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<ConditionYaml>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "loop")]
    pub loop_config: Option<LoopYaml>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extract: Option<Vec<ExtractorYaml>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assertions: Option<Vec<AssertionYaml>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "with_items_from_csv")]
    pub with_items_from_csv: Option<CsvConfigYaml>,
}

fn default_enabled() -> bool {
    true
}

/// YAML format for HTTP request
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequestYaml {
    pub method: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<serde_json::Value>,
}

/// YAML format for delay step
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DelayYaml {
    /// Duration in milliseconds
    pub duration: u64,
}

/// YAML format for script step
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScriptYaml {
    pub code: String,
}

/// YAML format for condition step
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConditionYaml {
    pub condition: String,
    #[serde(rename = "trueSteps", default)]
    pub true_steps: Vec<String>,
    #[serde(rename = "falseSteps", default)]
    pub false_steps: Vec<String>,
}

/// YAML format for loop step
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoopYaml {
    #[serde(rename = "type")]
    pub loop_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "iteratorVariable")]
    pub iterator_variable: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "dataSource")]
    pub data_source: Option<String>,
    #[serde(default)]
    pub steps: Vec<String>,
}

/// YAML format for variable extractor
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExtractorYaml {
    pub name: String,
    pub source: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "defaultValue")]
    pub default_value: Option<serde_json::Value>,
}

/// YAML format for assertion
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssertionYaml {
    pub name: String,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    pub operator: String,
    pub expected: serde_json::Value,
}

/// YAML format for CSV configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CsvConfigYaml {
    #[serde(rename = "file_name")]
    pub file_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "quote_char")]
    pub quote_char: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delimiter: Option<String>,
}

// ============================================================================
// Conversion Functions: Internal Types -> YAML
// ============================================================================

/// Convert a TestScenario and its steps to YAML format
pub fn scenario_to_yaml(
    scenario: &TestScenario,
    steps: &[TestScenarioStep],
    base_url: Option<String>,
) -> ScenarioYaml {
    let variables: HashMap<String, serde_json::Value> = scenario
        .variables
        .as_object()
        .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default();

    ScenarioYaml {
        name: scenario.name.clone(),
        description: scenario.description.clone(),
        priority: scenario.priority.clone(),
        base_url,
        variables,
        pre_script: scenario.pre_script.clone(),
        post_script: scenario.post_script.clone(),
        steps: steps.iter().map(step_to_yaml).collect(),
    }
}

/// Convert a TestScenarioStep to YAML format
fn step_to_yaml(step: &TestScenarioStep) -> StepYaml {
    let mut step_yaml = StepYaml {
        name: step.name.clone(),
        enabled: step.enabled,
        request: None,
        delay: None,
        script: None,
        condition: None,
        loop_config: None,
        extract: None,
        assertions: None,
        with_items_from_csv: None,
    };

    match step.step_type {
        TestStepType::Request => {
            if let Ok(config) = serde_json::from_value::<RequestStepConfig>(step.config.clone()) {
                step_yaml.request = Some(RequestYaml {
                    method: config.method,
                    url: config.url,
                    headers: config.headers,
                    params: config.params,
                    body: config.body,
                });

                // Extract variables
                if let Some(extractors) = config.extract_variables {
                    if !extractors.is_empty() {
                        step_yaml.extract = Some(
                            extractors
                                .iter()
                                .map(|e| ExtractorYaml {
                                    name: e.name.clone(),
                                    source: e.source.clone(),
                                    path: e.path.clone(),
                                    default_value: e.default_value.clone(),
                                })
                                .collect(),
                        );
                    }
                }

                // Assertions
                if let Some(assertions) = config.assertions {
                    if !assertions.is_empty() {
                        step_yaml.assertions = Some(
                            assertions
                                .iter()
                                .map(|a| AssertionYaml {
                                    name: a.name.clone(),
                                    source: a.source.clone(),
                                    path: a.path.clone(),
                                    operator: a.operator.clone(),
                                    expected: a.expected.clone(),
                                })
                                .collect(),
                        );
                    }
                }

                // CSV config
                if let Some(csv_config) = config.with_items_from_csv {
                    step_yaml.with_items_from_csv = Some(CsvConfigYaml {
                        file_name: csv_config.file_name,
                        quote_char: csv_config.quote_char.map(|c| c.to_string()),
                        delimiter: csv_config.delimiter.map(|c| c.to_string()),
                    });
                }
            }
        }
        TestStepType::Delay => {
            if let Ok(config) = serde_json::from_value::<DelayStepConfig>(step.config.clone()) {
                step_yaml.delay = Some(DelayYaml {
                    duration: config.duration_ms,
                });
            }
        }
        TestStepType::Script => {
            if let Ok(config) = serde_json::from_value::<ScriptStepConfig>(step.config.clone()) {
                step_yaml.script = Some(ScriptYaml { code: config.code });
            }
        }
        TestStepType::Condition => {
            if let Ok(config) = serde_json::from_value::<ConditionStepConfig>(step.config.clone()) {
                step_yaml.condition = Some(ConditionYaml {
                    condition: config.condition,
                    true_steps: config.true_steps,
                    false_steps: config.false_steps,
                });
            }
        }
        TestStepType::Loop => {
            if let Ok(config) = serde_json::from_value::<LoopStepConfig>(step.config.clone()) {
                step_yaml.loop_config = Some(LoopYaml {
                    loop_type: config.loop_type,
                    count: config.count,
                    iterator_variable: config.iterator_variable,
                    data_source: config.data_source,
                    steps: config.steps,
                });
            }
        }
    }

    step_yaml
}

/// Convert scenario to YAML string
pub fn scenario_to_yaml_string(
    scenario: &TestScenario,
    steps: &[TestScenarioStep],
    base_url: Option<String>,
) -> Result<String, String> {
    let yaml = scenario_to_yaml(scenario, steps, base_url);
    serde_yaml::to_string(&yaml).map_err(|e| format!("Failed to serialize to YAML: {}", e))
}

/// Convert multiple scenarios to project YAML string
pub fn project_scenarios_to_yaml_string(
    project_name: &str,
    base_url: Option<String>,
    scenarios_with_steps: Vec<(&TestScenario, &[TestScenarioStep])>,
) -> Result<String, String> {
    let project_yaml = ProjectScenariosYaml {
        project_name: project_name.to_string(),
        base_url: base_url.clone(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        scenarios: scenarios_with_steps
            .into_iter()
            .map(|(scenario, steps)| scenario_to_yaml(scenario, steps, base_url.clone()))
            .collect(),
    };
    serde_yaml::to_string(&project_yaml)
        .map_err(|e| format!("Failed to serialize project to YAML: {}", e))
}

// ============================================================================
// Conversion Functions: YAML -> Internal Types
// ============================================================================

/// Auto-correct YAML by parsing and re-serializing with serde_yaml
/// This normalizes indentation, spacing, and fixes minor syntax issues
pub fn auto_correct_yaml(yaml_content: &str) -> Result<String, String> {
    // Try to parse as generic YAML value first
    let value: serde_yaml::Value = serde_yaml::from_str(yaml_content)
        .map_err(|e| format!("Failed to parse YAML for auto-correction: {}", e))?;
    
    // Re-serialize with proper formatting
    serde_yaml::to_string(&value)
        .map_err(|e| format!("Failed to serialize corrected YAML: {}", e))
}

/// Parse YAML string to ScenarioYaml with auto-correction
/// If initial parse fails, attempts to auto-correct the YAML and parse again
pub fn parse_scenario_yaml(yaml_content: &str) -> Result<ScenarioYaml, String> {
    // First attempt: try to parse directly
    match serde_yaml::from_str::<ScenarioYaml>(yaml_content) {
        Ok(scenario) => Ok(scenario),
        Err(first_error) => {
            // Second attempt: try to auto-correct and parse again
            log::warn!("Initial YAML parse failed: {}. Attempting auto-correction...", first_error);
            
            match auto_correct_yaml(yaml_content) {
                Ok(corrected_yaml) => {
                    // Try parsing the corrected YAML
                    serde_yaml::from_str::<ScenarioYaml>(&corrected_yaml)
                        .map_err(|e| format!("Failed to parse YAML even after auto-correction: {}", e))
                }
                Err(_) => {
                    // If auto-correction fails, return the original error
                    Err(format!("Failed to parse YAML: {}", first_error))
                }
            }
        }
    }
}

/// Parse YAML string to ProjectScenariosYaml with auto-correction
/// If initial parse fails, attempts to auto-correct the YAML and parse again
pub fn parse_project_scenarios_yaml(yaml_content: &str) -> Result<ProjectScenariosYaml, String> {
    // First attempt: try to parse directly
    match serde_yaml::from_str::<ProjectScenariosYaml>(yaml_content) {
        Ok(project) => Ok(project),
        Err(first_error) => {
            // Second attempt: try to auto-correct and parse again
            log::warn!("Initial project YAML parse failed: {}. Attempting auto-correction...", first_error);
            
            match auto_correct_yaml(yaml_content) {
                Ok(corrected_yaml) => {
                    // Try parsing the corrected YAML
                    serde_yaml::from_str::<ProjectScenariosYaml>(&corrected_yaml)
                        .map_err(|e| format!("Failed to parse project YAML even after auto-correction: {}", e))
                }
                Err(_) => {
                    // If auto-correction fails, return the original error
                    Err(format!("Failed to parse project YAML: {}", first_error))
                }
            }
        }
    }
}

/// Convert ScenarioYaml to TestScenario (without ID - will be assigned on save)
pub fn yaml_to_scenario(yaml: &ScenarioYaml, project_id: &str) -> TestScenario {
    let now = chrono::Utc::now().timestamp();
    TestScenario {
        id: uuid::Uuid::new_v4().to_string(),
        project_id: project_id.to_string(),
        name: yaml.name.clone(),
        description: yaml.description.clone(),
        priority: yaml.priority.clone(),
        variables: serde_json::to_value(&yaml.variables).unwrap_or(serde_json::json!({})),
        pre_script: yaml.pre_script.clone(),
        post_script: yaml.post_script.clone(),
        created_at: now,
        updated_at: now,
    }
}

/// Convert StepYaml to TestScenarioStep
pub fn yaml_to_step(yaml: &StepYaml, scenario_id: &str, step_order: i32) -> TestScenarioStep {
    let (step_type, config) = determine_step_type_and_config(yaml);

    TestScenarioStep {
        id: uuid::Uuid::new_v4().to_string(),
        scenario_id: scenario_id.to_string(),
        step_order,
        step_type,
        name: yaml.name.clone(),
        config,
        enabled: yaml.enabled,
    }
}

/// Determine step type and config from YAML
fn determine_step_type_and_config(yaml: &StepYaml) -> (TestStepType, serde_json::Value) {
    if let Some(request) = &yaml.request {
        let config = RequestStepConfig {
            endpoint_id: None,
            url: request.url.clone(),
            method: request.method.clone(),
            headers: request.headers.clone(),
            params: request.params.clone(),
            body: request.body.clone(),
            extract_variables: yaml.extract.as_ref().map(|extractors| {
                extractors
                    .iter()
                    .map(|e| VariableExtractor {
                        name: e.name.clone(),
                        source: e.source.clone(),
                        path: e.path.clone(),
                        default_value: e.default_value.clone(),
                    })
                    .collect()
            }),
            assertions: yaml.assertions.as_ref().map(|assertions| {
                assertions
                    .iter()
                    .map(|a| Assertion {
                        name: a.name.clone(),
                        source: a.source.clone(),
                        path: a.path.clone(),
                        operator: a.operator.clone(),
                        expected: a.expected.clone(),
                        actual: None,
                        passed: None,
                        error: None,
                    })
                    .collect()
            }),
            with_items_from_csv: yaml.with_items_from_csv.as_ref().map(|csv_yaml| {
                CsvConfig {
                    file_name: csv_yaml.file_name.clone(),
                    quote_char: csv_yaml.quote_char.as_ref().and_then(|s| s.chars().next()),
                    delimiter: csv_yaml.delimiter.as_ref().and_then(|s| s.chars().next()),
                }
            }),
        };
        return (TestStepType::Request, serde_json::to_value(config).unwrap());
    }

    if let Some(delay) = &yaml.delay {
        let config = DelayStepConfig {
            duration_ms: delay.duration,
        };
        return (TestStepType::Delay, serde_json::to_value(config).unwrap());
    }

    if let Some(script) = &yaml.script {
        let config = ScriptStepConfig {
            code: script.code.clone(),
        };
        return (TestStepType::Script, serde_json::to_value(config).unwrap());
    }

    if let Some(condition) = &yaml.condition {
        let config = ConditionStepConfig {
            condition: condition.condition.clone(),
            true_steps: condition.true_steps.clone(),
            false_steps: condition.false_steps.clone(),
        };
        return (TestStepType::Condition, serde_json::to_value(config).unwrap());
    }

    if let Some(loop_config) = &yaml.loop_config {
        let config = LoopStepConfig {
            loop_type: loop_config.loop_type.clone(),
            count: loop_config.count,
            iterator_variable: loop_config.iterator_variable.clone(),
            data_source: loop_config.data_source.clone(),
            steps: loop_config.steps.clone(),
        };
        return (TestStepType::Loop, serde_json::to_value(config).unwrap());
    }

    // Default to empty request if no type specified
    let config = RequestStepConfig {
        endpoint_id: None,
        url: String::new(),
        method: "GET".to_string(),
        headers: None,
        params: None,
        body: None,
        extract_variables: None,
        assertions: None,
        with_items_from_csv: None,
    };
    (TestStepType::Request, serde_json::to_value(config).unwrap())
}

/// Convert ScenarioYaml to TestScenario and TestScenarioSteps
pub fn yaml_to_scenario_with_steps(
    yaml: &ScenarioYaml,
    project_id: &str,
) -> (TestScenario, Vec<TestScenarioStep>) {
    let scenario = yaml_to_scenario(yaml, project_id);
    let steps: Vec<TestScenarioStep> = yaml
        .steps
        .iter()
        .enumerate()
        .map(|(i, step_yaml)| yaml_to_step(step_yaml, &scenario.id, i as i32))
        .collect();
    (scenario, steps)
}

// ============================================================================
// Preview Types for UI
// ============================================================================

/// Preview of a scenario import (for UI confirmation)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScenarioImportPreview {
    pub name: String,
    pub description: Option<String>,
    pub priority: String,
    #[serde(rename = "stepsCount")]
    pub steps_count: usize,
    #[serde(rename = "variablesCount")]
    pub variables_count: usize,
    pub steps: Vec<StepPreview>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StepPreview {
    pub name: String,
    #[serde(rename = "stepType")]
    pub step_type: String,
    pub enabled: bool,
}

/// Create import preview from YAML
pub fn create_import_preview(yaml: &ScenarioYaml) -> ScenarioImportPreview {
    ScenarioImportPreview {
        name: yaml.name.clone(),
        description: yaml.description.clone(),
        priority: yaml.priority.clone(),
        steps_count: yaml.steps.len(),
        variables_count: yaml.variables.len(),
        steps: yaml
            .steps
            .iter()
            .map(|s| StepPreview {
                name: s.name.clone(),
                step_type: determine_step_type_name(s),
                enabled: s.enabled,
            })
            .collect(),
    }
}

fn determine_step_type_name(yaml: &StepYaml) -> String {
    if yaml.request.is_some() {
        "request".to_string()
    } else if yaml.delay.is_some() {
        "delay".to_string()
    } else if yaml.script.is_some() {
        "script".to_string()
    } else if yaml.condition.is_some() {
        "condition".to_string()
    } else if yaml.loop_config.is_some() {
        "loop".to_string()
    } else {
        "unknown".to_string()
    }
}

/// Preview for project import
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectImportPreview {
    #[serde(rename = "projectName")]
    pub project_name: String,
    #[serde(rename = "scenariosCount")]
    pub scenarios_count: usize,
    #[serde(rename = "totalSteps")]
    pub total_steps: usize,
    pub scenarios: Vec<ScenarioImportPreview>,
}

/// Create project import preview from YAML
pub fn create_project_import_preview(yaml: &ProjectScenariosYaml) -> ProjectImportPreview {
    let scenarios: Vec<ScenarioImportPreview> = yaml
        .scenarios
        .iter()
        .map(create_import_preview)
        .collect();
    let total_steps: usize = scenarios.iter().map(|s| s.steps_count).sum();

    ProjectImportPreview {
        project_name: yaml.project_name.clone(),
        scenarios_count: scenarios.len(),
        total_steps,
        scenarios,
    }
}

// ============================================================================
// YAML Template Generation
// ============================================================================

/// Generate a YAML template with comments for AI tools
pub fn generate_yaml_template() -> String {
    r#"# Test Scenario YAML Template
# This file can be used by AI tools to generate test scenarios

name: "My Test Scenario"
description: "Description of what this scenario tests"
priority: medium  # Options: low, medium, high

# Global variables that can be used in any step with {{ variableName }} syntax
variables:
  baseUrl: "http://localhost:3000"
  authToken: ""

steps:
  # HTTP Request Step
  - name: "Login Request"
    request:
      method: POST
      url: "{{ baseUrl }}/api/auth/login"
      headers:
        Content-Type: "application/json"
      body:
        email: "test@example.com"
        password: "password123"
    # Extract values from response to use in later steps
    extract:
      - name: accessToken
        source: body        # Options: body, header, status
        path: data.token    # JSON path for body, header name for header
    # Validate response
    assertions:
      - name: "Status is 200"
        source: status      # Options: status, body, header, duration
        operator: equals    # Options: equals, notEquals, contains, matches, greaterThan, lessThan, exists
        expected: 200

  # Delay Step
  - name: "Wait before next request"
    delay:
      duration: 1000  # milliseconds

  # Script Step (JavaScript)
  - name: "Custom validation"
    script:
      code: |
        // Access variables with 'variables' object
        // Access last response with 'response' object
        console.log('Token:', variables.accessToken);

  # Another request using extracted variable
  - name: "Get User Profile"
    request:
      method: GET
      url: "{{ baseUrl }}/api/users/me"
      headers:
        Authorization: "Bearer {{ accessToken }}"
    assertions:
      - name: "Status is 200"
        source: status
        operator: equals
        expected: 200
"#.to_string()
}

/// Generate a YAML template using AI (Copilot CLI)
/// 
/// This function calls the Copilot CLI to generate a test scenario YAML template
/// based on the project context and user prompt.
/// 
/// # Arguments
/// * `project_path` - Path to the project directory where Copilot CLI will run
/// * `user_prompt` - User's prompt describing what kind of test scenario to generate
/// * `endpoints` - Optional list of API endpoints to include in the context
/// * `base_url` - Optional base URL for the API
/// 
/// # Returns
/// * `Ok(String)` - Generated YAML template
/// * `Err(String)` - Error message if generation fails
pub async fn generate_yaml_template_with_ai(
    project_path: &str,
    user_prompt: &str,
    endpoints: Option<&[ApiEndpoint]>,
    base_url: Option<&str>,
) -> Result<String, String> {
    // Build context from endpoints
    let endpoints_context = build_endpoints_context(endpoints);
    
    // Build the full prompt with YAML schema information
    let full_prompt = build_ai_prompt(user_prompt, &endpoints_context, base_url);
    
    // Execute Copilot CLI
    match execute_copilot_cli(project_path, &full_prompt).await {
        Ok(output) => {
            // Try to extract YAML from the output
            match extract_yaml_from_output(&output) {
                Some(yaml) => {
                    log::info!("Successfully extracted YAML from Copilot output");
                    Ok(yaml)
                },
                None => {
                    log::warn!("Could not extract YAML using extract_yaml_from_output, trying fallback strategies");
                    
                    // Fallback 1: If output contains "name:" and "steps:", try to use it as-is
                    // (might have some explanatory text but YAML is there)
                    if output.contains("name:") && output.contains("steps:") {
                        log::info!("Output contains name: and steps:, using as YAML (may contain explanatory text)");
                        // Try to clean it up a bit - remove obvious non-YAML lines at the start
                        let lines: Vec<&str> = output.lines().collect();
                        let mut cleaned_lines = Vec::new();
                        let mut found_yaml_start = false;
                        
                        for line in lines {
                            let trimmed = line.trim();
                            if trimmed.starts_with("name:") {
                                found_yaml_start = true;
                                cleaned_lines.push(line);
                            } else if found_yaml_start {
                                // Keep all lines after "name:" that look like YAML
                                if trimmed.is_empty() || 
                                   line.starts_with(' ') || 
                                   line.starts_with('\t') || 
                                   line.starts_with('-') ||
                                   trimmed.starts_with('#') ||
                                   trimmed.contains(':') ||
                                   (trimmed.len() < 100 && !trimmed.ends_with('.') && !trimmed.ends_with('!')) {
                                    cleaned_lines.push(line);
                                } else if trimmed.len() > 50 && (trimmed.ends_with('.') || trimmed.ends_with('!')) {
                                    // Likely explanatory text, stop here
                                    break;
                                } else {
                                    cleaned_lines.push(line);
                                }
                            }
                        }
                        
                        if !cleaned_lines.is_empty() {
                            let cleaned_yaml = cleaned_lines.join("\n");
                            log::info!("Returning cleaned YAML (may not be perfect but should work)");
                            return Ok(cleaned_yaml);
                        }
                        
                        // If cleaning didn't help, return raw output
                        log::info!("Returning raw output as YAML (contains name: and steps:)");
                        Ok(output)
                    } else {
                        // Last resort: if output is not empty and has some YAML-like structure, return it
                        // This allows user to manually fix it in the editor
                        if !output.trim().is_empty() && output.contains(':') {
                            log::warn!("Output doesn't have standard YAML structure but contains some YAML-like content, returning it anyway");
                            Ok(output.trim().to_string())
                        } else {
                            Err(format!("Copilot CLI did not generate valid YAML. Output: {}", 
                                if output.len() > 500 { 
                                    format!("{}...", &output[..500]) 
                                } else { 
                                    output.clone() 
                                }))
                        }
                    }
                }
            }
        }
        Err(e) => {
            log::error!("Copilot CLI failed: {}", e);
            Err(e)
        }
    }
}

/// Format a single response property to text (recursive for nested properties)
fn format_property(prop: &ResponseProperty, indent: usize) -> String {
    let indent_str = "  ".repeat(indent);
    let required_str = if prop.required { "required" } else { "optional" };
    let mut result = format!(
        "{}  - {}: {} ({})",
        indent_str,
        prop.name,
        prop.property_type,
        required_str
    );
    
    if let Some(ref desc) = prop.description {
        if !desc.is_empty() {
            result.push_str(&format!(" - {}", desc));
        }
    }
    
    if let Some(ref format) = prop.format {
        result.push_str(&format!(" [format: {}]", format));
    }
    
    result.push('\n');
    
    // Add nested properties if any
    if let Some(ref nested) = prop.nested_properties {
        for nested_prop in nested {
            result.push_str(&format_property(nested_prop, indent + 1));
        }
    }
    
    result
}

/// Format response schema from serde_json::Value to readable text
fn format_response_schema(response: &ApiResponseDefinition) -> String {
    let mut result = String::new();
    
    // Add status code and description
    result.push_str(&format!(
        "  Response Schema ({}): {}\n",
        response.status_code,
        response.description
    ));
    
    // Try to deserialize schema from JSON
    if let Some(ref schema_value) = response.schema {
        match serde_json::from_value::<ResponseSchema>(schema_value.clone()) {
            Ok(schema) => {
                // Add schema type info
                if schema.is_wrapped {
                    result.push_str("    Note: Response is wrapped in {success, data} structure\n");
                }
                
                if let Some(ref ref_name) = schema.ref_name {
                    result.push_str(&format!("    Reference: {}\n", ref_name));
                }
                
                // Format properties
                if !schema.properties.is_empty() {
                    result.push_str("    Properties:\n");
                    for prop in &schema.properties {
                        result.push_str(&format_property(prop, 0));
                    }
                } else if schema.schema_type == "array" {
                    result.push_str(&format!("    Type: array\n"));
                    if let Some(ref items_schema) = schema.items_schema {
                        if !items_schema.properties.is_empty() {
                            result.push_str("    Array items:\n");
                            for prop in &items_schema.properties {
                                result.push_str(&format_property(prop, 0));
                            }
                        }
                    }
                } else {
                    result.push_str(&format!("    Type: {}\n", schema.schema_type));
                }
            }
            Err(_) => {
                // If deserialization fails, try to format as JSON (fallback)
                if let Some(schema_str) = schema_value.as_object() {
                    result.push_str("    Schema structure:\n");
                    // Add a simplified representation
                    if let Some(prop_type) = schema_str.get("schemaType") {
                        result.push_str(&format!("      Type: {}\n", prop_type));
                    }
                }
            }
        }
    }
    
    // Add example if available
    if let Some(ref example) = response.example {
        result.push_str("    Example:\n");
        if let Ok(example_str) = serde_json::to_string_pretty(example) {
            // Limit example length to avoid too long context
            let example_lines: Vec<&str> = example_str.lines().collect();
            let total_lines = example_lines.len();
            let lines_to_show: Vec<&str> = example_lines.iter().take(10).copied().collect();
            result.push_str(&format!("      {}\n", lines_to_show.join("\n      ")));
            if total_lines > 10 {
                result.push_str("      ... (truncated)\n");
            }
        }
    }
    
    result
}

/// Build context string from API endpoints
fn build_endpoints_context(endpoints: Option<&[ApiEndpoint]>) -> String {
    match endpoints {
        Some(eps) if !eps.is_empty() => {
            let mut context = String::from("Available API endpoints:\n");
            for ep in eps.iter().take(20) { // Limit to 20 endpoints to avoid prompt being too long
                context.push_str(&format!(
                    "- {} {} - {}\n",
                    ep.method,
                    ep.path,
                    ep.description
                ));
                
                // Add parameters if any
                if !ep.parameters.is_empty() {
                    context.push_str("  Parameters:\n");
                    for param in &ep.parameters {
                        let required = if param.required { "(required)" } else { "(optional)" };
                        context.push_str(&format!(
                            "    - {}: {} {}\n",
                            param.name,
                            param.param_type,
                            required
                        ));
                    }
                }
                
                // Add response schemas if any
                if let Some(ref responses) = ep.responses {
                    if !responses.is_empty() {
                        // Sort responses: success responses (200-299) first, then others
                        let mut sorted_responses = responses.clone();
                        sorted_responses.sort_by(|a, b| {
                            let a_is_success = a.status_code >= 200 && a.status_code < 300;
                            let b_is_success = b.status_code >= 200 && b.status_code < 300;
                            match (a_is_success, b_is_success) {
                                (true, false) => std::cmp::Ordering::Less,
                                (false, true) => std::cmp::Ordering::Greater,
                                _ => a.status_code.cmp(&b.status_code),
                            }
                        });
                        
                        // Limit to 3 responses to avoid too long context (prioritize success)
                        let responses_to_show = sorted_responses.iter().take(3);
                        
                        context.push_str("  Response Schemas:\n");
                        for response in responses_to_show {
                            context.push_str(&format_response_schema(response));
                        }
                        
                        if sorted_responses.len() > 3 {
                            context.push_str(&format!(
                                "    ... and {} more response definitions\n",
                                sorted_responses.len() - 3
                            ));
                        }
                    }
                }
            }
            if eps.len() > 20 {
                context.push_str(&format!("  ... and {} more endpoints\n", eps.len() - 20));
            }
            context
        }
        _ => String::new()
    }
}

/// Build the full AI prompt with YAML schema information
fn build_ai_prompt(user_prompt: &str, endpoints_context: &str, base_url: Option<&str>) -> String {
    let base_url_info = match base_url {
        Some(url) => format!("Base URL: {}\n", url),
        None => String::new()
    };
    
    format!(
        r#"Generate a test scenario YAML file for API testing. The YAML must follow this exact schema:

```yaml
name: "Scenario Name"
description: "Description of what this scenario tests"
priority: medium  # Options: low, medium, high

variables:
  baseUrl: "http://localhost:3000"
  # Add any variables needed

steps:
  # HTTP Request Step
  - name: "Step Name"
    request:
      method: GET|POST|PUT|DELETE|PATCH
      url: "{{{{ baseUrl }}}}/api/path"
      headers:
        Content-Type: "application/json"
      body:  # For POST/PUT/PATCH
        key: "value"
    extract:  # Extract values from response
      - name: variableName
        source: body|header|status
        path: json.path.to.value
    assertions:
      - name: "Assertion description"
        source: status|body|header|duration
        operator: equals|notEquals|contains|matches|greaterThan|lessThan|exists
        expected: value

  # Delay Step
  - name: "Wait"
    delay:
      duration: 1000  # milliseconds

  # Script Step (JavaScript)
  - name: "Custom Script"
    script:
      code: |
        // Access variables with 'variables' object
        // Access last response with 'response' object
        console.log(variables.token);
```

{base_url_info}
{endpoints_context}

User request: {user_prompt}

Generate ONLY the YAML content, no explanations. The YAML should be valid and ready to use."#,
        base_url_info = base_url_info,
        endpoints_context = endpoints_context,
        user_prompt = user_prompt
    )
}

/// Execute Copilot CLI command in the project directory
async fn execute_copilot_cli(project_path: &str, prompt: &str) -> Result<String, String> {
    let path = Path::new(project_path);
    
    if !path.exists() {
        return Err(format!("Project path does not exist: {}", project_path));
    }
    
    // Escape the prompt for shell
    let escaped_prompt = prompt.replace('\'', "'\\''");
    
    // Build the copilot command with safety flags
    let output = Command::new("copilot")
        .arg("-p")
        .arg(&escaped_prompt)
        .arg("--allow-all-tools")
        .arg("--deny-tool").arg("shell(cd)")
        .arg("--deny-tool").arg("shell(git)")
        .arg("--deny-tool").arg("shell(pwd)")
        .arg("--deny-tool").arg("fetch")
        .arg("--deny-tool").arg("extensions")
        .arg("--deny-tool").arg("websearch")
        .arg("--deny-tool").arg("githubRepo")
        .current_dir(path)
        .output()
        .await
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "Copilot CLI is not installed. Please install it first: npm install -g @githubnext/github-copilot-cli".to_string()
            } else {
                format!("Failed to execute Copilot CLI: {}", e)
            }
        })?;
    
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Copilot CLI failed: {}", stderr))
    }
}

/// Extract YAML content from Copilot CLI output
/// This function tries multiple strategies to extract YAML even when there's explanatory text
fn extract_yaml_from_output(output: &str) -> Option<String> {
    // Strategy 1: Try to find YAML content between ```yaml and ``` markers
    if let Some(start) = output.find("```yaml") {
        let yaml_start = start + 7; // Length of "```yaml"
        if let Some(end) = output[yaml_start..].find("```") {
            let yaml = output[yaml_start..yaml_start + end].trim();
            if !yaml.is_empty() {
                return Some(yaml.to_string());
            }
        }
    }
    
    // Strategy 2: Try to find YAML content between ``` and ``` markers (generic code block)
    if let Some(start) = output.find("```") {
        let after_start = start + 3;
        // Skip language identifier if present (e.g., ```yaml, ```yml)
        let yaml_start = if output[after_start..].starts_with("yaml") || output[after_start..].starts_with("yml") {
            after_start + 4
        } else {
            after_start
        };
        
        if let Some(end) = output[yaml_start..].find("```") {
            let yaml = output[yaml_start..yaml_start + end].trim();
            // Check if it looks like YAML (has name: or steps:)
            if yaml.contains("name:") || (yaml.contains("steps:") && yaml.contains(':')) {
                return Some(yaml.to_string());
            }
        }
    }
    
    // Strategy 3: Find YAML starting from "name:" line (even with text before it)
    let lines: Vec<&str> = output.lines().collect();
    let mut yaml_lines = Vec::new();
    let mut in_yaml = false;
    let mut yaml_start_index = None;
    
    // Find where YAML starts (look for "name:" line)
    for (i, line) in lines.iter().enumerate() {
        let trimmed_line = line.trim();
        if trimmed_line.starts_with("name:") {
            yaml_start_index = Some(i);
            break;
        }
    }
    
    // If we found a "name:" line, extract from there
    if let Some(start_idx) = yaml_start_index {
        for (i, line) in lines.iter().enumerate() {
            if i < start_idx {
                continue;
            }
            
            let trimmed_line = line.trim();
            
            // Start collecting when we hit "name:"
            if trimmed_line.starts_with("name:") {
                in_yaml = true;
                yaml_lines.push(line);
            } else if in_yaml {
                // Continue collecting YAML lines
                // YAML lines typically:
                // - Start with spaces (indentation)
                // - Start with '-' (list items)
                // - Contain ':' (key-value pairs)
                // - Are empty lines (within YAML structure)
                // - Start with '#' (comments)
                
                if trimmed_line.is_empty() {
                    // Empty line - keep it if we're in YAML context
                    yaml_lines.push(line);
                } else if line.starts_with(' ') || line.starts_with('\t') || 
                         line.starts_with('-') || 
                         trimmed_line.starts_with('#') ||
                         trimmed_line.contains(':') {
                    // Looks like YAML - keep it
                    yaml_lines.push(line);
                } else if trimmed_line.len() > 0 && 
                         !trimmed_line.chars().next().unwrap().is_alphanumeric() &&
                         !trimmed_line.starts_with("```") {
                    // Might be continuation of YAML (special chars)
                    yaml_lines.push(line);
                } else {
                    // Check if this looks like explanatory text (sentence-like)
                    // If it's a complete sentence or paragraph, we've probably left YAML
                    let looks_like_text = trimmed_line.len() > 50 || 
                                         trimmed_line.ends_with('.') ||
                                         trimmed_line.ends_with('!') ||
                                         (trimmed_line.contains(' ') && trimmed_line.matches(' ').count() > 5);
                    
                    if looks_like_text && yaml_lines.len() > 5 {
                        // We have enough YAML, stop here
                        break;
                    } else if !looks_like_text {
                        // Might still be YAML, keep it
                        yaml_lines.push(line);
                    } else {
                        break;
                    }
                }
            }
        }
        
        if !yaml_lines.is_empty() {
            let extracted: String = yaml_lines.iter().map(|s| s.to_string()).collect::<Vec<_>>().join("\n");
            // Verify it has at least name: and looks like YAML
            if extracted.contains("name:") && extracted.contains(':') {
                return Some(extracted);
            }
        }
    }
    
    // Strategy 4: If output contains "name:" and "steps:", try to extract the YAML portion
    // by finding lines that look like YAML structure
    if output.contains("name:") && output.contains("steps:") {
        let mut yaml_lines = Vec::new();
        let mut found_name = false;
        
        for line in lines {
            let trimmed = line.trim();
            
            if trimmed.starts_with("name:") {
                found_name = true;
                yaml_lines.push(line);
            } else if found_name {
                // Continue collecting until we hit clear non-YAML text
                if trimmed.is_empty() || 
                   line.starts_with(' ') || 
                   line.starts_with('\t') || 
                   line.starts_with('-') ||
                   trimmed.starts_with('#') ||
                   trimmed.contains(':') {
                    yaml_lines.push(line);
                } else if trimmed.len() < 100 && !trimmed.ends_with('.') {
                    // Short line that might be YAML
                    yaml_lines.push(line);
                } else {
                    // Probably explanatory text, stop
                    break;
                }
            }
        }
        
        if !yaml_lines.is_empty() {
            let extracted: String = yaml_lines.iter().map(|s| s.to_string()).collect::<Vec<_>>().join("\n");
            if extracted.contains("name:") {
                return Some(extracted);
            }
        }
    }
    
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_yaml() {
        let yaml = r#"
name: "Test Scenario"
priority: high
steps:
  - name: "GET Request"
    request:
      method: GET
      url: /api/test
"#;
        let result = parse_scenario_yaml(yaml);
        assert!(result.is_ok());
        let scenario = result.unwrap();
        assert_eq!(scenario.name, "Test Scenario");
        assert_eq!(scenario.priority, "high");
        assert_eq!(scenario.steps.len(), 1);
    }

    #[test]
    fn test_auto_correct_yaml() {
        // YAML with improper indentation and spacing
        let bad_yaml = r#"
name:   "Test"
priority:    medium
variables:
  baseUrl:     "http://localhost"
  token:  "abc"
steps:
  -  name:   "Step 1"
     enabled:  true
"#;
        let result = auto_correct_yaml(bad_yaml);
        assert!(result.is_ok());
        
        let corrected = result.unwrap();
        // The corrected YAML should be valid and properly formatted
        let parsed: serde_yaml::Value = serde_yaml::from_str(&corrected).unwrap();
        assert!(parsed.get("name").is_some());
        assert!(parsed.get("priority").is_some());
    }

    #[test]
    fn test_parse_yaml_with_auto_correction() {
        // YAML with spacing issues that should be auto-corrected
        let yaml_with_issues = r#"
name:    "Test Scenario"
priority:   high
steps:
  -   name:  "GET Request"
      request:
        method:  GET
        url:   /api/test
"#;
        let result = parse_scenario_yaml(yaml_with_issues);
        assert!(result.is_ok(), "Should parse YAML even with spacing issues");
        
        let scenario = result.unwrap();
        assert_eq!(scenario.name, "Test Scenario");
        assert_eq!(scenario.priority, "high");
        assert_eq!(scenario.steps.len(), 1);
    }

    #[test]
    fn test_roundtrip_conversion() {
        let yaml_content = r#"
name: "Roundtrip Test"
description: "Test roundtrip conversion"
priority: medium
variables:
  token: "abc123"
steps:
  - name: "Request Step"
    request:
      method: POST
      url: /api/login
      body:
        email: "test@test.com"
    assertions:
      - name: "Status OK"
        source: status
        operator: equals
        expected: 200
"#;
        // Parse YAML
        let parsed = parse_scenario_yaml(yaml_content).unwrap();
        
        // Convert to internal types
        let (scenario, steps) = yaml_to_scenario_with_steps(&parsed, "test-project-id");
        
        // Convert back to YAML
        let yaml_output = scenario_to_yaml_string(&scenario, &steps, None).unwrap();
        
        // Parse the output again
        let reparsed = parse_scenario_yaml(&yaml_output).unwrap();
        
        // Verify
        assert_eq!(reparsed.name, "Roundtrip Test");
        assert_eq!(reparsed.steps.len(), 1);
    }
}
