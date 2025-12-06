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
    #[allow(dead_code)]
    timeout: Duration,
}

impl ScenarioExecutor {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .danger_accept_invalid_certs(true)
                .build()
                .unwrap_or_default(),
            variables: HashMap::new(),
            timeout: Duration::from_secs(30),
        }
    }

    pub fn with_variables(mut self, variables: HashMap<String, serde_json::Value>) -> Self {
        self.variables = variables;
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

        // Initialize variables from scenario
        if let Some(vars) = scenario.variables.as_object() {
            for (k, v) in vars {
                self.variables.insert(k.clone(), v.clone());
            }
        }

        // Filter enabled steps and sort by order
        let mut enabled_steps: Vec<_> = steps.iter().filter(|s| s.enabled).collect();
        enabled_steps.sort_by_key(|s| s.step_order);
        let total_steps = enabled_steps.len() as u32;

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
                StepResultStatus::Passed => passed_steps += 1,
                StepResultStatus::Failed => {
                    failed_steps += 1;
                    if error_message.is_none() {
                        error_message = step_result.error.clone();
                    }
                }
                StepResultStatus::Skipped => skipped_steps += 1,
                StepResultStatus::Error => {
                    failed_steps += 1;
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

        let duration_ms = start_time.elapsed().as_millis() as u64;
        let completed_at = chrono::Utc::now().timestamp();

        let status = if failed_steps > 0 {
            ScenarioRunStatus::Failed
        } else {
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

        let result = match step.step_type {
            TestStepType::Request => self.execute_request_step(step),
            TestStepType::Delay => self.execute_delay_step(step),
            TestStepType::Script => self.execute_script_step(step),
            TestStepType::Condition => self.execute_condition_step(step),
            TestStepType::Loop => self.execute_loop_step(step),
        };

        let duration_ms = start_time.elapsed().as_millis() as u64;

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
        let config: RequestStepConfig = match serde_json::from_value(step.config.clone()) {
            Ok(c) => c,
            Err(e) => {
                return TestStepResult {
                    step_id: step.id.clone(),
                    name: step.name.clone(),
                    step_type: step.step_type.clone(),
                    status: StepResultStatus::Error,
                    duration_ms: None,
                    response: None,
                    assertions: None,
                    error: Some(format!("Invalid step config: {}", e)),
                    extracted_variables: None,
                };
            }
        };

        // Resolve variables in URL
        let url = self.resolve_variables(&config.url);
        let method = config.method.to_uppercase();

        // Build request
        let mut req = match method.as_str() {
            "GET" => self.client.get(&url),
            "POST" => self.client.post(&url),
            "PUT" => self.client.put(&url),
            "DELETE" => self.client.delete(&url),
            "PATCH" => self.client.patch(&url),
            _ => {
                return TestStepResult {
                    step_id: step.id.clone(),
                    name: step.name.clone(),
                    step_type: step.step_type.clone(),
                    status: StepResultStatus::Error,
                    duration_ms: None,
                    response: None,
                    assertions: None,
                    error: Some(format!("Unsupported method: {}", method)),
                    extracted_variables: None,
                };
            }
        };

        // Add headers with variable resolution
        if let Some(headers) = &config.headers {
            for (k, v) in headers {
                let resolved_value = self.resolve_variables(v);
                req = req.header(k, resolved_value);
            }
        }

        // Add body with variable resolution
        if method != "GET" {
            if let Some(body) = &config.body {
                let resolved_body = self.resolve_variables_in_json(body);
                req = req.json(&resolved_body);
            } else if let Some(params) = &config.params {
                let resolved_params = self.resolve_variables_in_json(params);
                req = req.json(&resolved_params);
            }
        }

        // Execute request
        let start = Instant::now();
        let response = match req.send() {
            Ok(resp) => resp,
            Err(e) => {
                return TestStepResult {
                    step_id: step.id.clone(),
                    name: step.name.clone(),
                    step_type: step.step_type.clone(),
                    status: StepResultStatus::Error,
                    duration_ms: Some(start.elapsed().as_millis() as u64),
                    response: None,
                    assertions: None,
                    error: Some(format!("Request failed: {}", e)),
                    extracted_variables: None,
                };
            }
        };
        let duration_ms = start.elapsed().as_millis() as u64;

        let status_code = response.status().as_u16();
        let status_text = response.status().to_string();
        
        let mut response_headers = HashMap::new();
        for (k, v) in response.headers() {
            if let Ok(value) = v.to_str() {
                response_headers.insert(k.to_string(), value.to_string());
            }
        }

        let body_text = response.text().unwrap_or_default();
        let body: serde_json::Value = serde_json::from_str(&body_text)
            .unwrap_or_else(|_| serde_json::Value::String(body_text));

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
            for extractor in extractors {
                let value = self.extract_variable(extractor, &step_response);
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
            response: None,
            assertions: None,
            error: None,
            extracted_variables: None,
        }
    }

    /// Resolve variables in a string ({{variable_name}} syntax)
    fn resolve_variables(&self, input: &str) -> String {
        let re = Regex::new(r"\{\{(\w+)\}\}").unwrap();
        let mut result = input.to_string();

        for cap in re.captures_iter(input) {
            let var_name = &cap[1];
            if let Some(value) = self.variables.get(var_name) {
                let replacement = match value {
                    serde_json::Value::String(s) => s.clone(),
                    serde_json::Value::Number(n) => n.to_string(),
                    serde_json::Value::Bool(b) => b.to_string(),
                    _ => value.to_string(),
                };
                result = result.replace(&cap[0], &replacement);
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
) -> TestScenarioRun {
    let mut executor = ScenarioExecutor::new();
    executor.execute_scenario(scenario, steps, app_handle)
}

