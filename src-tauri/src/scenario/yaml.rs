//! YAML serialization and deserialization for test scenarios
//! 
//! This module provides functionality to export/import test scenarios as YAML files,
//! making it easy for AI tools (like Copilot) to generate test scenarios.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::types::*;

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

/// Parse YAML string to ScenarioYaml
pub fn parse_scenario_yaml(yaml_content: &str) -> Result<ScenarioYaml, String> {
    serde_yaml::from_str(yaml_content)
        .map_err(|e| format!("Failed to parse YAML: {}", e))
}

/// Parse YAML string to ProjectScenariosYaml
pub fn parse_project_scenarios_yaml(yaml_content: &str) -> Result<ProjectScenariosYaml, String> {
    serde_yaml::from_str(yaml_content)
        .map_err(|e| format!("Failed to parse project YAML: {}", e))
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
