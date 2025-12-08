use super::types::*;
use reqwest::blocking::Client;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use regex::Regex;
use tauri::{AppHandle, Emitter};

/// Scenario Executor - Executes test scenarios step by step
pub struct ScenarioExecutor {
    client: Client,
    variables: HashMap<String, serde_json::Value>,
    base_url: Option<String>,
    #[allow(dead_code)]
    timeout: Duration,
}

impl ScenarioExecutor {
    pub fn new() -> Self {
        log::info!("[Executor] Creating ScenarioExecutor with timeout: 30s");
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .danger_accept_invalid_certs(true)
            .build()
            .unwrap_or_else(|e| {
                log::error!("[Executor] Failed to create client: {}", e);
                log::error!("[Executor] Error chain: {}", get_error_chain(&e));
                log::warn!("[Executor] Using default client");
                Client::new()
            });
        log::info!("[Executor] Client created successfully");
        Self {
            client,
            variables: HashMap::new(),
            base_url: None,
            timeout: Duration::from_secs(30),
        }
    }

    pub fn with_variables(mut self, variables: HashMap<String, serde_json::Value>) -> Self {
        self.variables = variables;
        self
    }

    pub fn with_base_url(mut self, base_url: Option<String>) -> Self {
        self.base_url = base_url;
        self
    }

    /// Execute a complete test scenario
    pub fn execute_scenario(
        &mut self,
        scenario: &TestScenario,
        steps: &[TestScenarioStep],
        app_handle: Option<&AppHandle>,
    ) -> TestScenarioRun {
        let run_id = uuid::Uuid::new_v4().to_string();
        let started_at = chrono::Utc::now().timestamp();
        let start_time = Instant::now();

        log::info!("[Executor] Starting scenario execution: {} (ID: {})", scenario.name, scenario.id);
        log::debug!("[Executor] Scenario ID: {}, Run ID: {}", scenario.id, run_id);

        // Initialize variables from scenario
        if let Some(vars) = scenario.variables.as_object() {
            log::debug!("[Executor] Initializing {} variables from scenario", vars.len());
            for (k, v) in vars {
                log::debug!("[Executor] Variable: {} = {:?}", k, v);
                self.variables.insert(k.clone(), v.clone());
            }
        } else {
            log::debug!("[Executor] No variables defined in scenario");
        }

        // Inject baseUrl from project's base_url (override if exists in scenario)
        let base_url_value = match &self.base_url {
            Some(url) => {
                log::debug!("[Executor] Injecting baseUrl variable from project: {}", url);
                url.clone()
            },
            None => {
                log::debug!("[Executor] No project base_url, using default for baseUrl: http://localhost:8080");
                "http://localhost:8080".to_string()
            }
        };
        self.variables.insert("baseUrl".to_string(), serde_json::Value::String(base_url_value));

        // Filter enabled steps and sort by order
        let mut enabled_steps: Vec<_> = steps.iter().filter(|s| s.enabled).collect();
        enabled_steps.sort_by_key(|s| s.step_order);
        let total_steps = enabled_steps.len() as u32;
        log::info!("[Executor] Total enabled steps: {} (out of {})", total_steps, steps.len());

        // Emit scenario started event
        if let Some(app) = app_handle {
            let _ = app.emit(
                "scenario-started",
                ScenarioStartedEvent {
                    run_id: run_id.clone(),
                    scenario_id: scenario.id.clone(),
                    total_steps,
                    started_at,
                },
            );
        }

        let mut results = Vec::new();
        let mut passed_steps = 0u32;
        let mut failed_steps = 0u32;
        let mut skipped_steps = 0u32;
        let mut error_message: Option<String> = None;

        for (index, step) in enabled_steps.iter().enumerate() {
            let step_index = index as u32;

            // Check if step has CSV config for expansion
            let csv_records = if step.step_type == TestStepType::Request {
                if let Ok(config) = serde_json::from_value::<RequestStepConfig>(step.config.clone()) {
                    if let Some(csv_config) = config.with_items_from_csv {
                        log::info!("[Executor] Step {} has CSV config, expanding with data from {}", 
                            step.name, csv_config.file_name);
                        match super::csv_reader::read_csv_to_records(&csv_config.file_name, &csv_config) {
                            Ok(records) => {
                                log::info!("[Executor] Loaded {} records from CSV", records.len());
                                Some(records)
                            },
                            Err(e) => {
                                log::error!("[Executor] Failed to read CSV: {}", e);
                                error_message = Some(format!("Failed to read CSV: {}", e));
                                None
                            }
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            };

            // Execute step once or multiple times based on CSV data
            if let Some(records) = csv_records {
                // Execute step for each CSV row
                for (csv_index, record) in records.iter().enumerate() {
                    log::info!("[Executor] Executing step {}/{} (CSV row {}): {} ({})", 
                        step_index + 1, total_steps, csv_index, step.name, step.step_type.as_str());

                    // Set CSV-specific variables
                    let mut item_obj = serde_json::Map::new();
                    for (key, value) in record {
                        item_obj.insert(key.clone(), serde_json::Value::String(value.clone()));
                    }
                    self.variables.insert("item".to_string(), serde_json::Value::Object(item_obj));
                    self.variables.insert("index".to_string(), serde_json::Value::Number(csv_index.into()));

                    // Emit step started event
                    if let Some(app) = app_handle {
                        let _ = app.emit(
                            "step-started",
                            StepStartedEvent {
                                run_id: run_id.clone(),
                                step_id: format!("{}-{}", step.id, csv_index),
                                step_index,
                                step_name: format!("{} (row {})", step.name, csv_index),
                                step_type: step.step_type.as_str().to_string(),
                            },
                        );
                    }

                    let step_result = self.execute_step(step);
                    
                    match step_result.status {
                        StepResultStatus::Passed => {
                            passed_steps += 1;
                            log::info!("[Executor] Step {} (CSV row {}) passed (duration: {}ms)", 
                                step.name, csv_index, step_result.duration_ms.unwrap_or(0));
                        },
                        StepResultStatus::Failed => {
                            failed_steps += 1;
                            log::warn!("[Executor] Step {} (CSV row {}) failed: {:?}", 
                                step.name, csv_index, step_result.error);
                            if error_message.is_none() {
                                error_message = step_result.error.clone();
                            }
                        }
                        StepResultStatus::Skipped => {
                            skipped_steps += 1;
                            log::info!("[Executor] Step {} (CSV row {}) skipped", step.name, csv_index);
                        },
                        StepResultStatus::Error => {
                            failed_steps += 1;
                            log::error!("[Executor] Step {} (CSV row {}) error: {:?}", 
                                step.name, csv_index, step_result.error);
                            if error_message.is_none() {
                                error_message = step_result.error.clone();
                            }
                        }
                        _ => {}
                    }

                    // Store extracted variables (but not item/index)
                    if let Some(ref extracted) = step_result.extracted_variables {
                        for (k, v) in extracted {
                            self.variables.insert(k.clone(), v.clone());
                        }
                    }

                    results.push(step_result.clone());

                    // Emit step completed event
                    if let Some(app) = app_handle {
                        let completed_count = results.len() as u32;
                        let progress_percentage = (completed_count as f64 / total_steps as f64) * 100.0;
                        let _ = app.emit(
                            "step-completed",
                            StepCompletedEvent {
                                run_id: run_id.clone(),
                                step_id: format!("{}-{}", step.id, csv_index),
                                step_index,
                                status: step_result.status.as_str().to_string(),
                                result: step_result,
                                progress_percentage,
                            },
                        );
                    }
                }
                
                // Clean up CSV variables after processing all rows
                self.variables.remove("item");
                self.variables.remove("index");
            } else {
                // Execute step normally (no CSV)
                log::info!("[Executor] Executing step {}/{}: {} ({})", 
                    step_index + 1, total_steps, step.name, step.step_type.as_str());

                // Emit step started event
                if let Some(app) = app_handle {
                    let _ = app.emit(
                        "step-started",
                        StepStartedEvent {
                            run_id: run_id.clone(),
                            step_id: step.id.clone(),
                            step_index,
                            step_name: step.name.clone(),
                            step_type: step.step_type.as_str().to_string(),
                        },
                    );
                }

                let step_result = self.execute_step(step);
                
                match step_result.status {
                    StepResultStatus::Passed => {
                        passed_steps += 1;
                        log::info!("[Executor] Step {} passed (duration: {}ms)", step.name, 
                            step_result.duration_ms.unwrap_or(0));
                    },
                    StepResultStatus::Failed => {
                        failed_steps += 1;
                        log::warn!("[Executor] Step {} failed: {:?}", step.name, step_result.error);
                        if error_message.is_none() {
                            error_message = step_result.error.clone();
                        }
                    }
                    StepResultStatus::Skipped => {
                        skipped_steps += 1;
                        log::info!("[Executor] Step {} skipped", step.name);
                    },
                    StepResultStatus::Error => {
                        failed_steps += 1;
                        log::error!("[Executor] Step {} error: {:?}", step.name, step_result.error);
                        if error_message.is_none() {
                            error_message = step_result.error.clone();
                        }
                    }
                    _ => {}
                }

                // Store extracted variables
                if let Some(ref extracted) = step_result.extracted_variables {
                    for (k, v) in extracted {
                        self.variables.insert(k.clone(), v.clone());
                    }
                }

                results.push(step_result.clone());

                // Emit step completed event
                if let Some(app) = app_handle {
                    let completed_count = (index + 1) as u32;
                    let progress_percentage = (completed_count as f64 / total_steps as f64) * 100.0;
                    let _ = app.emit(
                        "step-completed",
                        StepCompletedEvent {
                            run_id: run_id.clone(),
                            step_id: step.id.clone(),
                            step_index,
                            status: step_result.status.as_str().to_string(),
                            result: step_result,
                            progress_percentage,
                        },
                    );
                }
            }
        }

        let duration_ms = start_time.elapsed().as_millis() as u64;
        let completed_at = chrono::Utc::now().timestamp();

        let status = if failed_steps > 0 {
            log::warn!("[Executor] Scenario completed with failures: {}/{} passed, {}/{} failed", 
                passed_steps, total_steps, failed_steps, total_steps);
            ScenarioRunStatus::Failed
        } else {
            log::info!("[Executor] Scenario completed successfully: {}/{} passed ({}ms)", 
                passed_steps, total_steps, duration_ms);
            ScenarioRunStatus::Passed
        };

        let run = TestScenarioRun {
            id: run_id.clone(),
            scenario_id: scenario.id.clone(),
            status,
            total_steps: results.len() as u32,
            passed_steps,
            failed_steps,
            skipped_steps,
            duration_ms: Some(duration_ms),
            started_at,
            completed_at: Some(completed_at),
            error_message,
            results,
            variables: self.variables.clone(),
        };

        // Emit scenario completed event
        if let Some(app) = app_handle {
            let _ = app.emit("scenario-completed", ScenarioCompletedEvent {
                run_id: run_id.clone(),
                run: run.clone(),
            });
        }

        run
    }

    /// Execute a single step
    fn execute_step(&mut self, step: &TestScenarioStep) -> TestStepResult {
        let start_time = Instant::now();
        log::debug!("[Executor] Executing step: {} (type: {:?})", step.name, step.step_type);

        let result = match step.step_type {
            TestStepType::Request => {
                log::debug!("[Executor] Step type: Request");
                self.execute_request_step(step)
            },
            TestStepType::Delay => {
                log::debug!("[Executor] Step type: Delay");
                self.execute_delay_step(step)
            },
            TestStepType::Script => {
                log::debug!("[Executor] Step type: Script");
                self.execute_script_step(step)
            },
            TestStepType::Condition => {
                log::debug!("[Executor] Step type: Condition");
                self.execute_condition_step(step)
            },
            TestStepType::Loop => {
                log::debug!("[Executor] Step type: Loop");
                self.execute_loop_step(step)
            },
        };

        let duration_ms = start_time.elapsed().as_millis() as u64;
        log::debug!("[Executor] Step {} completed in {}ms", step.name, duration_ms);

        TestStepResult {
            step_id: step.id.clone(),
            name: step.name.clone(),
            step_type: step.step_type.clone(),
            duration_ms: Some(duration_ms),
            ..result
        }
    }

    /// Execute a request step
    fn execute_request_step(&mut self, step: &TestScenarioStep) -> TestStepResult {
        log::info!("[Executor] Executing request step: {}", step.name);
        
        let config: RequestStepConfig = match serde_json::from_value(step.config.clone()) {
            Ok(c) => {
                log::debug!("[Executor] Step config parsed successfully");
                c
            },
            Err(e) => {
                let error_msg = format!("Invalid step config: {}", e);
                log::error!("[Executor] Failed to parse step config: {}", error_msg);
                log::error!("[Executor] Error chain: {}", get_error_chain(&e));
                return TestStepResult {
                    step_id: step.id.clone(),
                    name: step.name.clone(),
                    step_type: step.step_type.clone(),
                    status: StepResultStatus::Error,
                    duration_ms: None,
                    request: None,
                    response: None,
                    assertions: None,
                    error: Some(error_msg),
                    extracted_variables: None,
                };
            }
        };

        // Resolve variables in URL
        let original_url = config.url.clone();
        let url_after_vars = self.resolve_variables(&config.url);
        
        // Resolve URL with base URL if needed
        let url = self.resolve_url(&url_after_vars);
        let method = config.method.to_uppercase();
        
        if original_url != url_after_vars {
            log::debug!("[Executor] URL after variable resolution: {} -> {}", original_url, url_after_vars);
        }
        if url_after_vars != url {
            log::debug!("[Executor] URL after base URL resolution: {} -> {}", url_after_vars, url);
        }
        log::info!("[Executor] Request: {} {}", method, url);

        let mut request_headers = HashMap::new();
        let mut request_body = None;

        // Build request
        log::debug!("[Executor] Building {} request", method);
        let mut req = match method.as_str() {
            "GET" => self.client.get(&url),
            "POST" => self.client.post(&url),
            "PUT" => self.client.put(&url),
            "DELETE" => self.client.delete(&url),
            "PATCH" => self.client.patch(&url),
            _ => {
                let error_msg = format!("Unsupported method: {}", method);
                log::error!("[Executor] {}", error_msg);
                return TestStepResult {
                    step_id: step.id.clone(),
                    name: step.name.clone(),
                    step_type: step.step_type.clone(),
                    status: StepResultStatus::Error,
                    duration_ms: None,
                    request: None,
                    response: None,
                    assertions: None,
                    error: Some(error_msg),
                    extracted_variables: None,
                };
            }
        };

        // Add headers with variable resolution
        if let Some(headers) = &config.headers {
            log::debug!("[Executor] Adding {} headers", headers.len());
            for (k, v) in headers {
                let resolved_value = self.resolve_variables(v);
                log::debug!("[Executor] Header: {} = {}", k, resolved_value);
                req = req.header(k, &resolved_value);
                request_headers.insert(k.clone(), resolved_value);
            }
        } else {
            log::debug!("[Executor] No custom headers provided");
        }

        // Add body with variable resolution
        if method != "GET" {
            if let Some(body) = &config.body {
                let resolved_body = self.resolve_variables_in_json(body);
                log::debug!("[Executor] Adding JSON body: {}", 
                    serde_json::to_string(&resolved_body).unwrap_or_else(|_| "invalid json".to_string()));
                req = req.json(&resolved_body);
                request_body = Some(resolved_body);
            } else if let Some(params) = &config.params {
                let resolved_params = self.resolve_variables_in_json(params);
                log::debug!("[Executor] Adding JSON params: {}", 
                    serde_json::to_string(&resolved_params).unwrap_or_else(|_| "invalid json".to_string()));
                req = req.json(&resolved_params);
                request_body = Some(resolved_params);
            } else {
                log::debug!("[Executor] No body or params for {} request", method);
            }
        }

        // Create StepRequest object
        let step_request = StepRequest {
            method: method.clone(),
            url: url.clone(),
            headers: request_headers,
            body: request_body,
        };

        // Execute request
        log::info!("[Executor] Sending {} request to {}", method, url);
        let start = Instant::now();
        let response = match req.send() {
            Ok(resp) => {
                let send_duration = start.elapsed().as_millis() as u64;
                log::info!("[Executor] Request sent successfully (took {}ms)", send_duration);
                resp
            },
            Err(e) => {
                let duration_ms = start.elapsed().as_millis() as u64;
                let error_msg = format!("Request failed: {}", e);
                log::error!("[Executor] Request failed after {}ms: {}", duration_ms, error_msg);
                log::error!("[Executor] Error chain: {}", get_error_chain(&e));
                log::error!("[Executor] Request URL: {}", url);
                log::error!("[Executor] Request method: {}", method);
                
                // Check if it's a timeout
                if e.is_timeout() {
                    log::warn!("[Executor] Request timeout after {}ms", duration_ms);
                }
                if e.is_connect() {
                    log::error!("[Executor] Connection error - server may be unreachable");
                }
                
                return TestStepResult {
                    step_id: step.id.clone(),
                    name: step.name.clone(),
                    step_type: step.step_type.clone(),
                    status: StepResultStatus::Error,
                    duration_ms: Some(duration_ms),
                    request: Some(step_request),
                    response: None,
                    assertions: None,
                    error: Some(error_msg),
                    extracted_variables: None,
                };
            }
        };
        let duration_ms = start.elapsed().as_millis() as u64;

        let status_code = response.status().as_u16();
        let status_text = response.status().to_string();
        
        log::info!("[Executor] Response received: {} {} (duration: {}ms)", status_code, status_text, duration_ms);
        
        let mut response_headers = HashMap::new();
        for (k, v) in response.headers() {
            if let Ok(value) = v.to_str() {
                log::debug!("[Executor] Response header: {} = {}", k, value);
                response_headers.insert(k.to_string(), value.to_string());
            }
        }

        log::debug!("[Executor] Reading response body");
        let body_text = response.text().unwrap_or_default();
        let body_text_for_preview = body_text.clone();
        let body: serde_json::Value = serde_json::from_str(&body_text)
            .unwrap_or_else(|_| serde_json::Value::String(body_text.clone()));
        
        if let Some(body_preview) = body_text_for_preview.get(0..200) {
            log::debug!("[Executor] Response body preview (first 200 chars): {}", body_preview);
        }

        let step_response = StepResponse {
            status: status_code,
            status_text,
            headers: response_headers.clone(),
            body: body.clone(),
            duration_ms,
        };

        // Extract variables
        let mut extracted_variables = HashMap::new();
        if let Some(extractors) = &config.extract_variables {
            log::debug!("[Executor] Extracting {} variables", extractors.len());
            for extractor in extractors {
                let value = self.extract_variable(extractor, &step_response);
                log::debug!("[Executor] Extracted variable: {} = {:?}", extractor.name, value);
                extracted_variables.insert(extractor.name.clone(), value);
            }
        }

        // Run assertions
        let mut assertions_results = Vec::new();
        let mut all_passed = true;
        
        if let Some(assertions) = &config.assertions {
            for assertion in assertions {
                let result = self.evaluate_assertion(assertion, &step_response, duration_ms);
                if result.passed != Some(true) {
                    all_passed = false;
                }
                assertions_results.push(result);
            }
        }

        let status = if all_passed {
            StepResultStatus::Passed
        } else {
            StepResultStatus::Failed
        };

        TestStepResult {
            step_id: step.id.clone(),
            name: step.name.clone(),
            step_type: step.step_type.clone(),
            status,
            duration_ms: Some(duration_ms),
            request: Some(step_request),
            response: Some(step_response),
            assertions: Some(assertions_results),
            error: None,
            extracted_variables: Some(extracted_variables),
        }
    }

    /// Execute a delay step
    fn execute_delay_step(&self, step: &TestScenarioStep) -> TestStepResult {
        let config: DelayStepConfig = match serde_json::from_value(step.config.clone()) {
            Ok(c) => c,
            Err(e) => {
                return TestStepResult {
                    step_id: step.id.clone(),
                    name: step.name.clone(),
                    step_type: step.step_type.clone(),
                    status: StepResultStatus::Error,
                    duration_ms: None,
                    request: None,
                    response: None,
                    assertions: None,
                    error: Some(format!("Invalid delay config: {}", e)),
                    extracted_variables: None,
                };
            }
        };

        std::thread::sleep(Duration::from_millis(config.duration_ms));

        TestStepResult {
            step_id: step.id.clone(),
            name: step.name.clone(),
            step_type: step.step_type.clone(),
            status: StepResultStatus::Passed,
            duration_ms: Some(config.duration_ms),
            request: None,
            response: None,
            assertions: None,
            error: None,
            extracted_variables: None,
        }
    }

    /// Execute a script step (basic implementation)
    fn execute_script_step(&mut self, step: &TestScenarioStep) -> TestStepResult {
        let config: ScriptStepConfig = match serde_json::from_value(step.config.clone()) {
            Ok(c) => c,
            Err(e) => {
                return TestStepResult {
                    step_id: step.id.clone(),
                    name: step.name.clone(),
                    step_type: step.step_type.clone(),
                    status: StepResultStatus::Error,
                    duration_ms: None,
                    request: None,
                    response: None,
                    assertions: None,
                    error: Some(format!("Invalid script config: {}", e)),
                    extracted_variables: None,
                };
            }
        };

        // For now, just log the script - full JS execution would require a JS runtime
        log::info!("Script step executed: {}", config.code);

        TestStepResult {
            step_id: step.id.clone(),
            name: step.name.clone(),
            step_type: step.step_type.clone(),
            status: StepResultStatus::Passed,
            duration_ms: Some(0),
            request: None,
            response: None,
            assertions: None,
            error: None,
            extracted_variables: None,
        }
    }

    /// Execute a condition step (basic implementation)
    fn execute_condition_step(&self, step: &TestScenarioStep) -> TestStepResult {
        // Condition steps are handled at scenario level, not individually
        TestStepResult {
            step_id: step.id.clone(),
            name: step.name.clone(),
            step_type: step.step_type.clone(),
            status: StepResultStatus::Passed,
            duration_ms: Some(0),
            request: None,
            response: None,
            assertions: None,
            error: None,
            extracted_variables: None,
        }
    }

    /// Execute a loop step (basic implementation)
    fn execute_loop_step(&self, step: &TestScenarioStep) -> TestStepResult {
        // Loop steps are handled at scenario level, not individually
        TestStepResult {
            step_id: step.id.clone(),
            name: step.name.clone(),
            step_type: step.step_type.clone(),
            status: StepResultStatus::Passed,
            duration_ms: Some(0),
            request: None,
            response: None,
            assertions: None,
            error: None,
            extracted_variables: None,
        }
    }

    /// Resolve URL with base URL if needed
    fn resolve_url(&self, url: &str) -> String {
        // If URL is already absolute, use it as-is
        if url.starts_with("http://") || url.starts_with("https://") {
            log::debug!("[Executor] URL is already absolute: {}", url);
            return url.to_string();
        }

        // If URL is relative (starts with /), prepend base_url
        if url.starts_with("/") {
            let base = match &self.base_url {
                Some(base) => {
                    // Remove trailing slash from base_url
                    let clean_base = base.trim_end_matches('/');
                    format!("{}{}", clean_base, url)
                },
                None => {
                    // Use default base URL if not provided
                    log::debug!("[Executor] No base URL provided, using default: http://localhost:8080");
                    format!("http://localhost:8080{}", url)
                }
            };
            log::debug!("[Executor] Resolved relative URL: {} -> {}", url, base);
            return base;
        }

        // If URL doesn't start with /, return as-is (might be a path without leading slash)
        log::debug!("[Executor] URL doesn't match absolute or relative pattern, using as-is: {}", url);
        url.to_string()
    }

    /// Resolve variables in a string ({{variable_name}} syntax)
    /// Supports:
    /// - {{var}} - simple variable
    /// - {{ var }} - variable with spaces
    /// - {{ item.column }} - CSV row column access
    /// - {{ index }} - CSV row index
    fn resolve_variables(&self, input: &str) -> String {
        // Support both {{ item.column }} and {{ variable }} patterns
        let re = Regex::new(r"\{\{\s*([\w.]+)\s*\}\}").unwrap();
        let mut result = input.to_string();

        for cap in re.captures_iter(input) {
            let var_path = &cap[1];
            
            // Check if it's a dotted path (e.g., item.column)
            if var_path.contains('.') {
                let parts: Vec<&str> = var_path.split('.').collect();
                if parts.len() == 2 {
                    let parent = parts[0];
                    let child = parts[1];
                    
                    // Try to resolve item.column
                    if let Some(parent_value) = self.variables.get(parent) {
                        if let Some(obj) = parent_value.as_object() {
                            if let Some(child_value) = obj.get(child) {
                                let replacement = match child_value {
                                    serde_json::Value::String(s) => s.clone(),
                                    serde_json::Value::Number(n) => n.to_string(),
                                    serde_json::Value::Bool(b) => b.to_string(),
                                    _ => child_value.to_string(),
                                };
                                log::debug!("[Executor] Resolving nested variable {}: {} -> {}", var_path, cap[0].to_string(), replacement);
                                result = result.replace(&cap[0], &replacement);
                                continue;
                            }
                        }
                    }
                }
            }
            
            // Simple variable lookup
            if let Some(value) = self.variables.get(var_path) {
                let replacement = match value {
                    serde_json::Value::String(s) => s.clone(),
                    serde_json::Value::Number(n) => n.to_string(),
                    serde_json::Value::Bool(b) => b.to_string(),
                    _ => value.to_string(),
                };
                log::debug!("[Executor] Resolving variable {}: {} -> {}", var_path, cap[0].to_string(), replacement);
                result = result.replace(&cap[0], &replacement);
            } else {
                log::warn!("[Executor] Variable {} not found in context", var_path);
            }
        }

        result
    }

    /// Resolve variables in a JSON value
    fn resolve_variables_in_json(&self, value: &serde_json::Value) -> serde_json::Value {
        match value {
            serde_json::Value::String(s) => {
                serde_json::Value::String(self.resolve_variables(s))
            }
            serde_json::Value::Object(map) => {
                let mut new_map = serde_json::Map::new();
                for (k, v) in map {
                    new_map.insert(k.clone(), self.resolve_variables_in_json(v));
                }
                serde_json::Value::Object(new_map)
            }
            serde_json::Value::Array(arr) => {
                let new_arr: Vec<_> = arr.iter()
                    .map(|v| self.resolve_variables_in_json(v))
                    .collect();
                serde_json::Value::Array(new_arr)
            }
            _ => value.clone(),
        }
    }

    /// Extract a variable from response
    fn extract_variable(&self, extractor: &VariableExtractor, response: &StepResponse) -> serde_json::Value {
        match extractor.source.as_str() {
            "status" => serde_json::Value::Number(response.status.into()),
            "header" => {
                response.headers.get(&extractor.path)
                    .map(|v| serde_json::Value::String(v.clone()))
                    .unwrap_or_else(|| extractor.default_value.clone().unwrap_or(serde_json::Value::Null))
            }
            "body" => {
                self.extract_json_path(&response.body, &extractor.path)
                    .unwrap_or_else(|| extractor.default_value.clone().unwrap_or(serde_json::Value::Null))
            }
            _ => extractor.default_value.clone().unwrap_or(serde_json::Value::Null),
        }
    }

    /// Extract value using simple JSON path (e.g., "data.user.id", "items[0].name")
    fn extract_json_path(&self, value: &serde_json::Value, path: &str) -> Option<serde_json::Value> {
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

    /// Evaluate an assertion
    fn evaluate_assertion(&self, assertion: &Assertion, response: &StepResponse, duration_ms: u64) -> Assertion {
        let actual = match assertion.source.as_str() {
            "status" => serde_json::Value::Number(response.status.into()),
            "duration" => serde_json::Value::Number(serde_json::Number::from(duration_ms)),
            "header" => {
                if let Some(path) = &assertion.path {
                    response.headers.get(path)
                        .map(|v| serde_json::Value::String(v.clone()))
                        .unwrap_or(serde_json::Value::Null)
                } else {
                    serde_json::Value::Null
                }
            }
            "body" => {
                if let Some(path) = &assertion.path {
                    self.extract_json_path(&response.body, path)
                        .unwrap_or(serde_json::Value::Null)
                } else {
                    response.body.clone()
                }
            }
            _ => serde_json::Value::Null,
        };

        let (passed, error) = self.compare_values(&actual, &assertion.expected, &assertion.operator);

        Assertion {
            name: assertion.name.clone(),
            source: assertion.source.clone(),
            path: assertion.path.clone(),
            operator: assertion.operator.clone(),
            expected: assertion.expected.clone(),
            actual: Some(actual),
            passed: Some(passed),
            error,
        }
    }

    /// Compare two values based on operator
    fn compare_values(&self, actual: &serde_json::Value, expected: &serde_json::Value, operator: &str) -> (bool, Option<String>) {
        match operator {
            "equals" => {
                let passed = actual == expected;
                let error = if !passed {
                    Some(format!("Expected {:?} but got {:?}", expected, actual))
                } else {
                    None
                };
                (passed, error)
            }
            "notEquals" => {
                let passed = actual != expected;
                let error = if !passed {
                    Some(format!("Expected value to not equal {:?}", expected))
                } else {
                    None
                };
                (passed, error)
            }
            "contains" => {
                let actual_str = match actual {
                    serde_json::Value::String(s) => s.clone(),
                    _ => actual.to_string(),
                };
                let expected_str = match expected {
                    serde_json::Value::String(s) => s.clone(),
                    _ => expected.to_string(),
                };
                let passed = actual_str.contains(&expected_str);
                let error = if !passed {
                    Some(format!("Expected {:?} to contain {:?}", actual_str, expected_str))
                } else {
                    None
                };
                (passed, error)
            }
            "matches" => {
                let actual_str = match actual {
                    serde_json::Value::String(s) => s.clone(),
                    _ => actual.to_string(),
                };
                let pattern = match expected {
                    serde_json::Value::String(s) => s.clone(),
                    _ => expected.to_string(),
                };
                let passed = Regex::new(&pattern)
                    .map(|re| re.is_match(&actual_str))
                    .unwrap_or(false);
                let error = if !passed {
                    Some(format!("Expected {:?} to match pattern {:?}", actual_str, pattern))
                } else {
                    None
                };
                (passed, error)
            }
            "greaterThan" => {
                let actual_num = actual.as_f64().unwrap_or(0.0);
                let expected_num = expected.as_f64().unwrap_or(0.0);
                let passed = actual_num > expected_num;
                let error = if !passed {
                    Some(format!("Expected {} to be greater than {}", actual_num, expected_num))
                } else {
                    None
                };
                (passed, error)
            }
            "lessThan" => {
                let actual_num = actual.as_f64().unwrap_or(0.0);
                let expected_num = expected.as_f64().unwrap_or(0.0);
                let passed = actual_num < expected_num;
                let error = if !passed {
                    Some(format!("Expected {} to be less than {}", actual_num, expected_num))
                } else {
                    None
                };
                (passed, error)
            }
            "exists" => {
                let passed = !actual.is_null();
                let error = if !passed {
                    Some("Expected value to exist but got null".to_string())
                } else {
                    None
                };
                (passed, error)
            }
            _ => (false, Some(format!("Unknown operator: {}", operator))),
        }
    }
}

/// Run a test scenario
pub fn run_scenario(
    scenario: &TestScenario,
    steps: &[TestScenarioStep],
    app_handle: Option<&AppHandle>,
    base_url: Option<String>,
) -> TestScenarioRun {
    log::info!("[Executor] run_scenario called for scenario: {}", scenario.name);
    log::info!("[Executor] Base URL: {:?}", base_url);
    let mut executor = ScenarioExecutor::new()
        .with_base_url(base_url);
    executor.execute_scenario(scenario, steps, app_handle)
}

fn get_error_chain(error: &dyn std::error::Error) -> String {
    let mut chain = vec![error.to_string()];
    let mut source = error.source();
    while let Some(err) = source {
        chain.push(err.to_string());
        source = err.source();
    }
    chain.join(" -> ")
}

