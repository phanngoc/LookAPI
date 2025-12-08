use super::types::*;
use super::metrics::MetricsCollector;
use super::stages::StageScheduler;
use crate::scenario::types::{
    TestScenario, TestScenarioStep, TestStepType, RequestStepConfig,
    VariableExtractor,
};
use reqwest::Client;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tokio::time::interval;
use regex::Regex;

/// PerformanceExecutor - Runs performance tests with multiple VUs
pub struct PerformanceExecutor {
    scenario: TestScenario,
    steps: Vec<TestScenarioStep>,
    config: PerformanceTestConfig,
    base_url: Option<String>,
}

impl PerformanceExecutor {
    pub fn new(
        scenario: TestScenario,
        steps: Vec<TestScenarioStep>,
        config: PerformanceTestConfig,
        base_url: Option<String>,
    ) -> Self {
        Self {
            scenario,
            steps,
            config,
            base_url,
        }
    }

    /// Run the performance test
    pub async fn run(&self, app_handle: Option<AppHandle>) -> PerformanceTestRun {
        let run_id = uuid::Uuid::new_v4().to_string();
        let started_at = chrono::Utc::now().timestamp();
        let start_time = Instant::now();

        log::info!(
            "[PerfExecutor] Starting performance test: {} (config: {})",
            self.scenario.name,
            self.config.id
        );

        // Emit start event
        if let Some(ref app) = app_handle {
            let _ = app.emit(
                "perf-started",
                PerfStartedEvent {
                    run_id: run_id.clone(),
                    config_id: self.config.id.clone(),
                    scenario_id: self.scenario.id.clone(),
                    started_at,
                },
            );
        }

        // Create shared state
        let metrics_collector = Arc::new(Mutex::new(MetricsCollector::new()));
        let stop_signal = Arc::new(AtomicBool::new(false));
        let current_vus = Arc::new(AtomicU32::new(0));
        let max_vus_reached = Arc::new(AtomicU32::new(0));
        let iteration_counter = Arc::new(AtomicU64::new(0));

        // Create stage scheduler
        let scheduler = self.create_stage_scheduler();
        let scheduler = Arc::new(scheduler);

        // Prepare scenario variables
        let scenario_vars = self.prepare_scenario_variables();

        // Filter enabled steps
        let enabled_steps: Vec<TestScenarioStep> = self
            .steps
            .iter()
            .filter(|s| s.enabled)
            .cloned()
            .collect();

        // Spawn progress reporter task
        let progress_handle = self.spawn_progress_reporter(
            app_handle.clone(),
            run_id.clone(),
            metrics_collector.clone(),
            scheduler.clone(),
            current_vus.clone(),
            stop_signal.clone(),
        );

        // Spawn VU manager task
        let vu_manager_handle = self.spawn_vu_manager(
            app_handle.clone(),
            run_id.clone(),
            enabled_steps.clone(),
            scenario_vars.clone(),
            metrics_collector.clone(),
            scheduler.clone(),
            stop_signal.clone(),
            current_vus.clone(),
            max_vus_reached.clone(),
            iteration_counter.clone(),
        );

        // Wait for completion
        let _ = tokio::join!(progress_handle, vu_manager_handle);

        // Calculate final metrics
        let final_metrics = {
            let collector = metrics_collector.lock().await;
            collector.calculate_aggregates()
        };

        // Evaluate thresholds
        let threshold_results = {
            let collector = metrics_collector.lock().await;
            collector.evaluate_thresholds(&self.config.thresholds)
        };

        // Determine final status
        let all_thresholds_passed = threshold_results.iter().all(|r| r.passed);
        let status = if all_thresholds_passed {
            PerformanceRunStatus::Passed
        } else {
            PerformanceRunStatus::Failed
        };

        let duration_ms = start_time.elapsed().as_millis() as u64;
        let completed_at = chrono::Utc::now().timestamp();

        log::info!(
            "[PerfExecutor] Performance test completed: status={:?}, requests={}, rps={:.2}, p95={}ms",
            status,
            final_metrics.total_requests,
            final_metrics.requests_per_second,
            final_metrics.duration_p95
        );

        let run = PerformanceTestRun {
            id: run_id.clone(),
            config_id: self.config.id.clone(),
            scenario_id: self.scenario.id.clone(),
            status,
            started_at,
            completed_at: Some(completed_at),
            duration_ms: Some(duration_ms),
            max_vus_reached: max_vus_reached.load(Ordering::SeqCst),
            metrics: Some(final_metrics),
            threshold_results,
            error_message: None,
        };

        // Emit completed event
        if let Some(ref app) = app_handle {
            let _ = app.emit(
                "perf-completed",
                PerfCompletedEvent {
                    run_id,
                    run: run.clone(),
                },
            );
        }

        run
    }

    /// Create stage scheduler based on config
    fn create_stage_scheduler(&self) -> StageScheduler {
        if let Some(ref stages) = self.config.stages {
            if !stages.is_empty() {
                return StageScheduler::new(stages.clone());
            }
        }

        // Fall back to fixed VUs/duration
        let vus = self.config.vus.unwrap_or(1);
        let duration = self.config.duration_secs.unwrap_or(30);
        StageScheduler::fixed(vus, duration)
    }

    /// Prepare scenario variables
    fn prepare_scenario_variables(&self) -> HashMap<String, serde_json::Value> {
        let mut vars = HashMap::new();

        // Add variables from scenario
        if let Some(obj) = self.scenario.variables.as_object() {
            for (k, v) in obj {
                vars.insert(k.clone(), v.clone());
            }
        }

        // Add base URL
        let base_url = self.base_url.clone().unwrap_or_else(|| "http://localhost:8080".to_string());
        vars.insert("baseUrl".to_string(), serde_json::Value::String(base_url));

        vars
    }

    /// Spawn progress reporter task
    fn spawn_progress_reporter(
        &self,
        app_handle: Option<AppHandle>,
        run_id: String,
        metrics_collector: Arc<Mutex<MetricsCollector>>,
        scheduler: Arc<StageScheduler>,
        current_vus: Arc<AtomicU32>,
        stop_signal: Arc<AtomicBool>,
    ) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(1));
            let mut last_stage_index: Option<usize> = None;

            loop {
                interval.tick().await;

                if stop_signal.load(Ordering::SeqCst) || scheduler.is_completed() {
                    break;
                }

                // Check for stage transition
                if let Some(new_stage_idx) = scheduler.check_stage_transition(last_stage_index) {
                    last_stage_index = Some(new_stage_idx);
                    
                    if let Some(ref app) = app_handle {
                        if let Some(stage) = scheduler.get_current_stage() {
                            let _ = app.emit(
                                "perf-stage-changed",
                                PerfStageChangedEvent {
                                    run_id: run_id.clone(),
                                    stage_index: new_stage_idx,
                                    target_vus: stage.target_vus,
                                    duration_secs: stage.duration_secs,
                                },
                            );
                        }
                    }
                }

                // Emit progress event
                if let Some(ref app) = app_handle {
                    let collector = metrics_collector.lock().await;
                    let _ = app.emit(
                        "perf-progress",
                        PerfProgressEvent {
                            run_id: run_id.clone(),
                            elapsed_secs: scheduler.get_elapsed_secs(),
                            current_vus: current_vus.load(Ordering::SeqCst),
                            total_requests: collector.get_metrics_count() as u64,
                            failed_requests: collector.get_failed_count(),
                            rps: collector.get_current_rps(),
                            error_rate: collector.get_error_rate(),
                            p95_duration: collector.get_p95_duration(),
                            iterations_completed: collector.get_total_iterations(),
                        },
                    );
                }
            }

            log::debug!("[PerfExecutor] Progress reporter stopped");
        })
    }

    /// Spawn VU manager task that manages virtual users
    fn spawn_vu_manager(
        &self,
        app_handle: Option<AppHandle>,
        run_id: String,
        steps: Vec<TestScenarioStep>,
        scenario_vars: HashMap<String, serde_json::Value>,
        metrics_collector: Arc<Mutex<MetricsCollector>>,
        scheduler: Arc<StageScheduler>,
        stop_signal: Arc<AtomicBool>,
        current_vus: Arc<AtomicU32>,
        max_vus_reached: Arc<AtomicU32>,
        iteration_counter: Arc<AtomicU64>,
    ) -> tokio::task::JoinHandle<()> {
        let base_url = self.base_url.clone();
        let iterations_limit = self.config.iterations;

        tokio::spawn(async move {
            let mut vu_handles: Vec<tokio::task::JoinHandle<()>> = Vec::new();
            let mut next_vu_id: u32 = 0;
            let mut check_interval = interval(Duration::from_millis(100));

            loop {
                check_interval.tick().await;

                // Check if we should stop
                if stop_signal.load(Ordering::SeqCst) {
                    break;
                }

                // Check if scheduler is done
                if scheduler.is_completed() {
                    break;
                }

                // Check iteration limit
                if let Some(limit) = iterations_limit {
                    if iteration_counter.load(Ordering::SeqCst) >= limit {
                        break;
                    }
                }

                // Get target VUs from scheduler
                let target_vus = scheduler.get_current_vus();
                let active_vus = current_vus.load(Ordering::SeqCst);

                // Update max VUs
                if active_vus > max_vus_reached.load(Ordering::SeqCst) {
                    max_vus_reached.store(active_vus, Ordering::SeqCst);
                }

                // Spawn new VUs if needed
                if active_vus < target_vus {
                    let vus_to_spawn = target_vus - active_vus;
                    for _ in 0..vus_to_spawn {
                        let vu_id = next_vu_id;
                        next_vu_id += 1;

                        let handle = spawn_vu(
                            vu_id,
                            steps.clone(),
                            scenario_vars.clone(),
                            base_url.clone(),
                            metrics_collector.clone(),
                            stop_signal.clone(),
                            current_vus.clone(),
                            iteration_counter.clone(),
                            iterations_limit,
                            app_handle.clone(),
                            run_id.clone(),
                        );

                        vu_handles.push(handle);
                        current_vus.fetch_add(1, Ordering::SeqCst);
                    }
                }

                // Clean up finished VU handles
                vu_handles.retain(|h| !h.is_finished());
            }

            // Signal all VUs to stop
            stop_signal.store(true, Ordering::SeqCst);

            // Wait for all VUs to finish (with timeout)
            let shutdown_timeout = Duration::from_secs(10);
            let _ = tokio::time::timeout(
                shutdown_timeout,
                futures::future::join_all(vu_handles),
            )
            .await;

            log::debug!("[PerfExecutor] VU manager stopped");
        })
    }
}

/// Spawn a single VU (Virtual User) task
fn spawn_vu(
    vu_id: u32,
    steps: Vec<TestScenarioStep>,
    scenario_vars: HashMap<String, serde_json::Value>,
    base_url: Option<String>,
    metrics_collector: Arc<Mutex<MetricsCollector>>,
    stop_signal: Arc<AtomicBool>,
    current_vus: Arc<AtomicU32>,
    iteration_counter: Arc<AtomicU64>,
    iterations_limit: Option<u64>,
    app_handle: Option<AppHandle>,
    run_id: String,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .danger_accept_invalid_certs(true)
            .build()
            .unwrap_or_else(|_| Client::new());

        let mut local_vars = scenario_vars.clone();
        let mut iteration: u64 = 0;

        log::debug!("[VU-{}] Started", vu_id);

        loop {
            // Check stop conditions
            if stop_signal.load(Ordering::SeqCst) {
                break;
            }

            if let Some(limit) = iterations_limit {
                if iteration_counter.load(Ordering::SeqCst) >= limit {
                    break;
                }
            }

            iteration += 1;
            log::trace!("[VU-{}] Starting iteration {}", vu_id, iteration);

            // Execute all steps in the scenario
            for step in &steps {
                if stop_signal.load(Ordering::SeqCst) {
                    break;
                }

                if step.step_type != TestStepType::Request {
                    // Only execute request steps for performance testing
                    continue;
                }

                let metric = execute_request_step(
                    &client,
                    step,
                    &mut local_vars,
                    base_url.as_deref(),
                    vu_id,
                    iteration,
                )
                .await;

                // Record metric
                {
                    let mut collector = metrics_collector.lock().await;
                    collector.record(metric.clone());
                }

                // Emit request completed event
                if let Some(ref app) = app_handle {
                    let _ = app.emit(
                        "perf-request-completed",
                        PerfRequestCompletedEvent {
                            run_id: run_id.clone(),
                            vu_id,
                            step_name: metric.step_name.clone(),
                            duration_ms: metric.duration_ms,
                            success: metric.success,
                            status: metric.status,
                        },
                    );
                }
            }

            // Increment global iteration counter
            iteration_counter.fetch_add(1, Ordering::SeqCst);

            // Small delay between iterations to prevent overwhelming
            tokio::time::sleep(Duration::from_millis(10)).await;
        }

        // Decrement current VUs count
        current_vus.fetch_sub(1, Ordering::SeqCst);
        log::debug!("[VU-{}] Stopped after {} iterations", vu_id, iteration);
    })
}

/// Execute a single request step and return metrics
async fn execute_request_step(
    client: &Client,
    step: &TestScenarioStep,
    variables: &mut HashMap<String, serde_json::Value>,
    base_url: Option<&str>,
    vu_id: u32,
    iteration: u64,
) -> RequestMetric {
    let start_time = Instant::now();
    let timestamp = chrono::Utc::now().timestamp();

    // Parse config
    let config: RequestStepConfig = match serde_json::from_value(step.config.clone()) {
        Ok(c) => c,
        Err(_e) => {
            return RequestMetric {
                step_id: step.id.clone(),
                step_name: step.name.clone(),
                method: "UNKNOWN".to_string(),
                url: "".to_string(),
                status: 0,
                duration_ms: start_time.elapsed().as_millis() as u64,
                success: false,
                vu_id,
                iteration,
                timestamp,
            };
        }
    };

    // Resolve URL
    let url = resolve_url(&resolve_variables(&config.url, variables), base_url);
    let method = config.method.to_uppercase();

    // Build request
    let mut req = match method.as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        _ => client.get(&url),
    };

    // Add headers
    if let Some(ref headers) = config.headers {
        for (k, v) in headers {
            req = req.header(k, resolve_variables(v, variables));
        }
    }

    // Add body
    if method != "GET" {
        if let Some(ref body) = config.body {
            req = req.json(&resolve_variables_in_json(body, variables));
        } else if let Some(ref params) = config.params {
            req = req.json(&resolve_variables_in_json(params, variables));
        }
    }

    // Execute request
    let response = req.send().await;
    let duration_ms = start_time.elapsed().as_millis() as u64;

    match response {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let success = resp.status().is_success();

            // Extract variables if needed
            if let Some(ref extractors) = config.extract_variables {
                if let Ok(body_text) = resp.text().await {
                    let body: serde_json::Value = serde_json::from_str(&body_text)
                        .unwrap_or(serde_json::Value::String(body_text));
                    
                    for extractor in extractors {
                        if let Some(value) = extract_variable(&extractor, &body, status) {
                            variables.insert(extractor.name.clone(), value);
                        }
                    }
                }
            }

            RequestMetric {
                step_id: step.id.clone(),
                step_name: step.name.clone(),
                method,
                url,
                status,
                duration_ms,
                success,
                vu_id,
                iteration,
                timestamp,
            }
        }
        Err(e) => {
            log::warn!("[VU-{}] Request failed: {} - {}", vu_id, url, e);
            RequestMetric {
                step_id: step.id.clone(),
                step_name: step.name.clone(),
                method,
                url,
                status: 0,
                duration_ms,
                success: false,
                vu_id,
                iteration,
                timestamp,
            }
        }
    }
}

/// Resolve variables in a string ({{variable}} syntax)
fn resolve_variables(input: &str, variables: &HashMap<String, serde_json::Value>) -> String {
    let re = Regex::new(r"\{\{\s*([\w.]+)\s*\}\}").unwrap();
    let mut result = input.to_string();

    for cap in re.captures_iter(input) {
        let var_path = &cap[1];

        // Handle dotted paths (e.g., item.field)
        if var_path.contains('.') {
            let parts: Vec<&str> = var_path.split('.').collect();
            if parts.len() == 2 {
                if let Some(parent) = variables.get(parts[0]) {
                    if let Some(obj) = parent.as_object() {
                        if let Some(child) = obj.get(parts[1]) {
                            let replacement = value_to_string(child);
                            result = result.replace(&cap[0], &replacement);
                            continue;
                        }
                    }
                }
            }
        }

        // Simple variable lookup
        if let Some(value) = variables.get(var_path) {
            let replacement = value_to_string(value);
            result = result.replace(&cap[0], &replacement);
        }
    }

    result
}

/// Resolve variables in JSON
fn resolve_variables_in_json(
    value: &serde_json::Value,
    variables: &HashMap<String, serde_json::Value>,
) -> serde_json::Value {
    match value {
        serde_json::Value::String(s) => {
            serde_json::Value::String(resolve_variables(s, variables))
        }
        serde_json::Value::Object(map) => {
            let mut new_map = serde_json::Map::new();
            for (k, v) in map {
                new_map.insert(k.clone(), resolve_variables_in_json(v, variables));
            }
            serde_json::Value::Object(new_map)
        }
        serde_json::Value::Array(arr) => {
            let new_arr: Vec<_> = arr
                .iter()
                .map(|v| resolve_variables_in_json(v, variables))
                .collect();
            serde_json::Value::Array(new_arr)
        }
        _ => value.clone(),
    }
}

/// Convert JSON value to string
fn value_to_string(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        _ => value.to_string(),
    }
}

/// Resolve URL with base URL
fn resolve_url(url: &str, base_url: Option<&str>) -> String {
    if url.starts_with("http://") || url.starts_with("https://") {
        return url.to_string();
    }

    if url.starts_with("/") {
        if let Some(base) = base_url {
            return format!("{}{}", base.trim_end_matches('/'), url);
        }
    }

    url.to_string()
}

/// Extract variable from response
fn extract_variable(
    extractor: &VariableExtractor,
    body: &serde_json::Value,
    status: u16,
) -> Option<serde_json::Value> {
    match extractor.source.as_str() {
        "status" => Some(serde_json::Value::Number(status.into())),
        "body" => extract_json_path(body, &extractor.path),
        _ => None,
    }
}

/// Extract value using JSON path
fn extract_json_path(value: &serde_json::Value, path: &str) -> Option<serde_json::Value> {
    let parts: Vec<&str> = path.split('.').collect();
    let mut current = value.clone();

    for part in parts {
        // Handle array access like "items[0]"
        if let Some(bracket_pos) = part.find('[') {
            let key = &part[..bracket_pos];
            let index_str = &part[bracket_pos + 1..part.len() - 1];

            if !key.is_empty() {
                current = current.get(key)?.clone();
            }

            if let Ok(index) = index_str.parse::<usize>() {
                current = current.get(index)?.clone();
            }
        } else {
            current = current.get(part)?.clone();
        }
    }

    Some(current)
}

/// Run a performance test (public function for use in commands)
pub async fn run_performance_test(
    scenario: TestScenario,
    steps: Vec<TestScenarioStep>,
    config: PerformanceTestConfig,
    base_url: Option<String>,
    app_handle: Option<AppHandle>,
) -> PerformanceTestRun {
    let executor = PerformanceExecutor::new(scenario, steps, config, base_url);
    executor.run(app_handle).await
}
