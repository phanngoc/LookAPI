use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Test Scenario - A collection of test steps that can be executed sequentially
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestScenario {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub priority: String, // "low", "medium", "high"
    pub variables: serde_json::Value, // Global variables
    #[serde(rename = "preScript")]
    pub pre_script: Option<String>,
    #[serde(rename = "postScript")]
    pub post_script: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// Step types for test scenarios
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum TestStepType {
    #[serde(rename = "request")]
    Request,
    #[serde(rename = "condition")]
    Condition,
    #[serde(rename = "loop")]
    Loop,
    #[serde(rename = "delay")]
    Delay,
    #[serde(rename = "script")]
    Script,
}

impl TestStepType {
    pub fn as_str(&self) -> &'static str {
        match self {
            TestStepType::Request => "request",
            TestStepType::Condition => "condition",
            TestStepType::Loop => "loop",
            TestStepType::Delay => "delay",
            TestStepType::Script => "script",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "request" => TestStepType::Request,
            "condition" => TestStepType::Condition,
            "loop" => TestStepType::Loop,
            "delay" => TestStepType::Delay,
            "script" => TestStepType::Script,
            _ => TestStepType::Request,
        }
    }
}

/// Test Scenario Step - A single step in a test scenario
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestScenarioStep {
    pub id: String,
    #[serde(rename = "scenarioId")]
    pub scenario_id: String,
    #[serde(rename = "stepOrder")]
    pub step_order: i32,
    #[serde(rename = "stepType")]
    pub step_type: TestStepType,
    pub name: String,
    pub config: serde_json::Value, // Step-specific configuration
    pub enabled: bool,
}

/// Request Step Configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequestStepConfig {
    #[serde(rename = "endpointId")]
    pub endpoint_id: Option<String>,
    pub url: String,
    pub method: String,
    pub headers: Option<HashMap<String, String>>,
    pub params: Option<serde_json::Value>,
    pub body: Option<serde_json::Value>,
    #[serde(rename = "extractVariables")]
    pub extract_variables: Option<Vec<VariableExtractor>>,
    pub assertions: Option<Vec<Assertion>>,
}

/// Condition Step Configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConditionStepConfig {
    pub condition: String, // JavaScript expression
    #[serde(rename = "trueSteps")]
    pub true_steps: Vec<String>, // Step IDs to execute if true
    #[serde(rename = "falseSteps")]
    pub false_steps: Vec<String>, // Step IDs to execute if false
}

/// Loop Step Configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoopStepConfig {
    #[serde(rename = "loopType")]
    pub loop_type: String, // "for", "foreach", "while"
    pub count: Option<i32>, // For "for" loops
    #[serde(rename = "iteratorVariable")]
    pub iterator_variable: Option<String>, // Variable name for iterator
    #[serde(rename = "dataSource")]
    pub data_source: Option<String>, // Variable name containing array for foreach
    pub steps: Vec<String>, // Step IDs to loop
}

/// Delay Step Configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DelayStepConfig {
    #[serde(rename = "durationMs")]
    pub duration_ms: u64,
}

/// Script Step Configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScriptStepConfig {
    pub code: String, // JavaScript code
}

/// Variable Extractor - Extract data from response
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VariableExtractor {
    pub name: String,
    pub source: String, // "body", "header", "status"
    pub path: String,   // JSONPath or header name
    #[serde(rename = "defaultValue")]
    pub default_value: Option<serde_json::Value>,
}

/// Assertion - Validate response
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Assertion {
    pub name: String,
    pub source: String,   // "status", "body", "header", "duration"
    pub path: Option<String>, // JSONPath for body, header name for header
    pub operator: String, // "equals", "contains", "matches", "greaterThan", "lessThan", "notEquals", "exists"
    pub expected: serde_json::Value,
    pub actual: Option<serde_json::Value>,
    pub passed: Option<bool>,
    pub error: Option<String>,
}

/// Scenario Run Status
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ScenarioRunStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "running")]
    Running,
    #[serde(rename = "passed")]
    Passed,
    #[serde(rename = "failed")]
    Failed,
    #[serde(rename = "stopped")]
    Stopped,
    #[serde(rename = "error")]
    Error,
}

impl ScenarioRunStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ScenarioRunStatus::Pending => "pending",
            ScenarioRunStatus::Running => "running",
            ScenarioRunStatus::Passed => "passed",
            ScenarioRunStatus::Failed => "failed",
            ScenarioRunStatus::Stopped => "stopped",
            ScenarioRunStatus::Error => "error",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "pending" => ScenarioRunStatus::Pending,
            "running" => ScenarioRunStatus::Running,
            "passed" => ScenarioRunStatus::Passed,
            "failed" => ScenarioRunStatus::Failed,
            "stopped" => ScenarioRunStatus::Stopped,
            "error" => ScenarioRunStatus::Error,
            _ => ScenarioRunStatus::Pending,
        }
    }
}

/// Step Result Status
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum StepResultStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "running")]
    Running,
    #[serde(rename = "passed")]
    Passed,
    #[serde(rename = "failed")]
    Failed,
    #[serde(rename = "skipped")]
    Skipped,
    #[serde(rename = "error")]
    Error,
}

impl StepResultStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            StepResultStatus::Pending => "pending",
            StepResultStatus::Running => "running",
            StepResultStatus::Passed => "passed",
            StepResultStatus::Failed => "failed",
            StepResultStatus::Skipped => "skipped",
            StepResultStatus::Error => "error",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "pending" => StepResultStatus::Pending,
            "running" => StepResultStatus::Running,
            "passed" => StepResultStatus::Passed,
            "failed" => StepResultStatus::Failed,
            "skipped" => StepResultStatus::Skipped,
            "error" => StepResultStatus::Error,
            _ => StepResultStatus::Pending,
        }
    }
}

/// Test Scenario Run - Execution result of a test scenario
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestScenarioRun {
    pub id: String,
    #[serde(rename = "scenarioId")]
    pub scenario_id: String,
    pub status: ScenarioRunStatus,
    #[serde(rename = "totalSteps")]
    pub total_steps: u32,
    #[serde(rename = "passedSteps")]
    pub passed_steps: u32,
    #[serde(rename = "failedSteps")]
    pub failed_steps: u32,
    #[serde(rename = "skippedSteps")]
    pub skipped_steps: u32,
    #[serde(rename = "durationMs")]
    pub duration_ms: Option<u64>,
    #[serde(rename = "startedAt")]
    pub started_at: i64,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<i64>,
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
    pub results: Vec<TestStepResult>,
    pub variables: HashMap<String, serde_json::Value>, // Final state of variables
}

/// Test Step Result - Execution result of a single step
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestStepResult {
    #[serde(rename = "stepId")]
    pub step_id: String,
    pub name: String,
    #[serde(rename = "stepType")]
    pub step_type: TestStepType,
    pub status: StepResultStatus,
    #[serde(rename = "durationMs")]
    pub duration_ms: Option<u64>,
    pub request: Option<StepRequest>,
    pub response: Option<StepResponse>,
    pub assertions: Option<Vec<Assertion>>,
    pub error: Option<String>,
    #[serde(rename = "extractedVariables")]
    pub extracted_variables: Option<HashMap<String, serde_json::Value>>,
}

/// Step Request - HTTP request details sent in a step
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StepRequest {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<serde_json::Value>,
}

/// Step Response - HTTP response from a request step
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StepResponse {
    pub status: u16,
    #[serde(rename = "statusText")]
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: serde_json::Value,
    #[serde(rename = "durationMs")]
    pub duration_ms: u64,
}

/// Event payloads for real-time progress updates
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScenarioStartedEvent {
    #[serde(rename = "runId")]
    pub run_id: String,
    #[serde(rename = "scenarioId")]
    pub scenario_id: String,
    #[serde(rename = "totalSteps")]
    pub total_steps: u32,
    #[serde(rename = "startedAt")]
    pub started_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StepStartedEvent {
    #[serde(rename = "runId")]
    pub run_id: String,
    #[serde(rename = "stepId")]
    pub step_id: String,
    #[serde(rename = "stepIndex")]
    pub step_index: u32,
    #[serde(rename = "stepName")]
    pub step_name: String,
    #[serde(rename = "stepType")]
    pub step_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StepCompletedEvent {
    #[serde(rename = "runId")]
    pub run_id: String,
    #[serde(rename = "stepId")]
    pub step_id: String,
    #[serde(rename = "stepIndex")]
    pub step_index: u32,
    pub status: String,
    pub result: TestStepResult,
    #[serde(rename = "progressPercentage")]
    pub progress_percentage: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScenarioCompletedEvent {
    #[serde(rename = "runId")]
    pub run_id: String,
    pub run: TestScenarioRun,
}

/// Create Scenario Request
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateScenarioRequest {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub priority: Option<String>,
}

/// Update Scenario Request
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateScenarioRequest {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub variables: Option<serde_json::Value>,
    #[serde(rename = "preScript")]
    pub pre_script: Option<String>,
    #[serde(rename = "postScript")]
    pub post_script: Option<String>,
}

/// Create Step Request
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateStepRequest {
    #[serde(rename = "scenarioId")]
    pub scenario_id: String,
    #[serde(rename = "stepType")]
    pub step_type: TestStepType,
    pub name: String,
    pub config: serde_json::Value,
}

/// Update Step Request
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateStepRequest {
    pub id: String,
    pub name: Option<String>,
    pub config: Option<serde_json::Value>,
    pub enabled: Option<bool>,
}

/// Reorder Steps Request
#[derive(Debug, Serialize, Deserialize)]
pub struct ReorderStepsRequest {
    #[serde(rename = "scenarioId")]
    pub scenario_id: String,
    #[serde(rename = "stepIds")]
    pub step_ids: Vec<String>, // Ordered list of step IDs
}
