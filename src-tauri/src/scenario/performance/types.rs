use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Performance test type (inspired by k6)
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum PerformanceTestType {
    #[serde(rename = "smoke")]
    Smoke,      // Low VUs, short duration - sanity check
    #[serde(rename = "load")]
    Load,       // Medium VUs, with stages - baseline test
    #[serde(rename = "stress")]
    Stress,     // High VUs, find breaking point
    #[serde(rename = "spike")]
    Spike,      // Sudden increase in VUs
    #[serde(rename = "soak")]
    Soak,       // Long duration, find memory leaks
}

impl PerformanceTestType {
    pub fn as_str(&self) -> &'static str {
        match self {
            PerformanceTestType::Smoke => "smoke",
            PerformanceTestType::Load => "load",
            PerformanceTestType::Stress => "stress",
            PerformanceTestType::Spike => "spike",
            PerformanceTestType::Soak => "soak",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "smoke" => PerformanceTestType::Smoke,
            "load" => PerformanceTestType::Load,
            "stress" => PerformanceTestType::Stress,
            "spike" => PerformanceTestType::Spike,
            "soak" => PerformanceTestType::Soak,
            _ => PerformanceTestType::Load,
        }
    }
}

/// Stage configuration for ramping VUs
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Stage {
    #[serde(rename = "durationSecs")]
    pub duration_secs: u64,    // Duration of this stage in seconds
    #[serde(rename = "targetVus")]
    pub target_vus: u32,       // Target VUs at the end of this stage
}

/// Threshold definition for pass/fail criteria
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Threshold {
    pub metric: String,        // "http_req_duration", "http_req_failed", etc.
    pub condition: String,     // "p(95)<500", "rate<0.05"
}

/// Threshold evaluation result
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ThresholdResult {
    pub threshold: Threshold,
    pub passed: bool,
    #[serde(rename = "actualValue")]
    pub actual_value: f64,
    pub message: String,
}

/// Performance Test Configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PerformanceTestConfig {
    pub id: String,
    #[serde(rename = "scenarioId")]
    pub scenario_id: String,
    pub name: String,
    #[serde(rename = "testType")]
    pub test_type: PerformanceTestType,
    pub vus: Option<u32>,                  // Fixed VUs (if not using stages)
    #[serde(rename = "durationSecs")]
    pub duration_secs: Option<u64>,        // Fixed duration in seconds
    pub iterations: Option<u64>,           // Or number of iterations
    pub stages: Option<Vec<Stage>>,        // Ramping stages
    pub thresholds: Vec<Threshold>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// Input for creating a performance test config
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreatePerformanceTestInput {
    #[serde(rename = "scenarioId")]
    pub scenario_id: String,
    pub name: String,
    #[serde(rename = "testType")]
    pub test_type: String,
    pub vus: Option<u32>,
    #[serde(rename = "durationSecs")]
    pub duration_secs: Option<u64>,
    pub iterations: Option<u64>,
    pub stages: Option<Vec<Stage>>,
    pub thresholds: Option<Vec<Threshold>>,
}

/// Metrics for a single HTTP request
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequestMetric {
    #[serde(rename = "stepId")]
    pub step_id: String,
    #[serde(rename = "stepName")]
    pub step_name: String,
    pub method: String,
    pub url: String,
    pub status: u16,
    #[serde(rename = "durationMs")]
    pub duration_ms: u64,
    pub success: bool,
    #[serde(rename = "vuId")]
    pub vu_id: u32,
    pub iteration: u64,
    pub timestamp: i64,
}

/// Per-step aggregated metrics
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct StepMetrics {
    #[serde(rename = "stepName")]
    pub step_name: String,
    #[serde(rename = "totalRequests")]
    pub total_requests: u64,
    #[serde(rename = "failedRequests")]
    pub failed_requests: u64,
    #[serde(rename = "errorRate")]
    pub error_rate: f64,
    #[serde(rename = "durationMin")]
    pub duration_min: u64,
    #[serde(rename = "durationMax")]
    pub duration_max: u64,
    #[serde(rename = "durationAvg")]
    pub duration_avg: f64,
    #[serde(rename = "durationMed")]
    pub duration_med: u64,      // p50
    #[serde(rename = "durationP90")]
    pub duration_p90: u64,
    #[serde(rename = "durationP95")]
    pub duration_p95: u64,
    #[serde(rename = "durationP99")]
    pub duration_p99: u64,
}

/// Aggregated metrics for the entire performance test
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AggregatedMetrics {
    #[serde(rename = "totalRequests")]
    pub total_requests: u64,
    #[serde(rename = "failedRequests")]
    pub failed_requests: u64,
    #[serde(rename = "errorRate")]
    pub error_rate: f64,
    
    // Response time percentiles (in ms)
    #[serde(rename = "durationMin")]
    pub duration_min: u64,
    #[serde(rename = "durationMax")]
    pub duration_max: u64,
    #[serde(rename = "durationAvg")]
    pub duration_avg: f64,
    #[serde(rename = "durationMed")]
    pub duration_med: u64,      // p50
    #[serde(rename = "durationP90")]
    pub duration_p90: u64,
    #[serde(rename = "durationP95")]
    pub duration_p95: u64,
    #[serde(rename = "durationP99")]
    pub duration_p99: u64,
    
    // Throughput
    #[serde(rename = "requestsPerSecond")]
    pub requests_per_second: f64,
    #[serde(rename = "iterationsCompleted")]
    pub iterations_completed: u64,
    
    // Duration
    #[serde(rename = "totalDurationMs")]
    pub total_duration_ms: u64,
    
    // Per-step metrics
    #[serde(rename = "stepMetrics")]
    pub step_metrics: HashMap<String, StepMetrics>,
}

/// Performance run status
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum PerformanceRunStatus {
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

impl PerformanceRunStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            PerformanceRunStatus::Pending => "pending",
            PerformanceRunStatus::Running => "running",
            PerformanceRunStatus::Passed => "passed",
            PerformanceRunStatus::Failed => "failed",
            PerformanceRunStatus::Stopped => "stopped",
            PerformanceRunStatus::Error => "error",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "pending" => PerformanceRunStatus::Pending,
            "running" => PerformanceRunStatus::Running,
            "passed" => PerformanceRunStatus::Passed,
            "failed" => PerformanceRunStatus::Failed,
            "stopped" => PerformanceRunStatus::Stopped,
            "error" => PerformanceRunStatus::Error,
            _ => PerformanceRunStatus::Pending,
        }
    }
}

/// Performance Test Run Result
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PerformanceTestRun {
    pub id: String,
    #[serde(rename = "configId")]
    pub config_id: String,
    #[serde(rename = "scenarioId")]
    pub scenario_id: String,
    pub status: PerformanceRunStatus,
    #[serde(rename = "startedAt")]
    pub started_at: i64,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<i64>,
    #[serde(rename = "durationMs")]
    pub duration_ms: Option<u64>,
    #[serde(rename = "maxVusReached")]
    pub max_vus_reached: u32,
    pub metrics: Option<AggregatedMetrics>,
    #[serde(rename = "thresholdResults")]
    pub threshold_results: Vec<ThresholdResult>,
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
}

// ============================================================================
// Event payloads for real-time progress updates
// ============================================================================

/// Event emitted when performance test starts
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PerfStartedEvent {
    #[serde(rename = "runId")]
    pub run_id: String,
    #[serde(rename = "configId")]
    pub config_id: String,
    #[serde(rename = "scenarioId")]
    pub scenario_id: String,
    #[serde(rename = "startedAt")]
    pub started_at: i64,
}

/// Event emitted when a single request completes
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PerfRequestCompletedEvent {
    #[serde(rename = "runId")]
    pub run_id: String,
    #[serde(rename = "vuId")]
    pub vu_id: u32,
    #[serde(rename = "stepName")]
    pub step_name: String,
    #[serde(rename = "durationMs")]
    pub duration_ms: u64,
    pub success: bool,
    pub status: u16,
}

/// Event emitted periodically with progress metrics
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PerfProgressEvent {
    #[serde(rename = "runId")]
    pub run_id: String,
    #[serde(rename = "elapsedSecs")]
    pub elapsed_secs: u64,
    #[serde(rename = "currentVus")]
    pub current_vus: u32,
    #[serde(rename = "totalRequests")]
    pub total_requests: u64,
    #[serde(rename = "failedRequests")]
    pub failed_requests: u64,
    pub rps: f64,                    // Requests per second
    #[serde(rename = "errorRate")]
    pub error_rate: f64,
    #[serde(rename = "p95Duration")]
    pub p95_duration: u64,
    #[serde(rename = "iterationsCompleted")]
    pub iterations_completed: u64,
}

/// Event emitted when stage changes
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PerfStageChangedEvent {
    #[serde(rename = "runId")]
    pub run_id: String,
    #[serde(rename = "stageIndex")]
    pub stage_index: usize,
    #[serde(rename = "targetVus")]
    pub target_vus: u32,
    #[serde(rename = "durationSecs")]
    pub duration_secs: u64,
}

/// Event emitted when performance test completes
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PerfCompletedEvent {
    #[serde(rename = "runId")]
    pub run_id: String,
    pub run: PerformanceTestRun,
}
