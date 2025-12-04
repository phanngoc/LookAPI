use super::payloads::{get_leak_patterns, get_payloads};
use super::types::*;
use reqwest::blocking::Client;
use std::collections::HashMap;
use std::time::{Duration, Instant};

pub struct SecurityScanner {
    client: Client,
    timeout: Duration,
}

impl SecurityScanner {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .danger_accept_invalid_certs(true)
                .build()
                .unwrap_or_default(),
            timeout: Duration::from_secs(30),
        }
    }

    pub fn run_scan(
        &self,
        url: &str,
        method: &str,
        original_params: &HashMap<String, serde_json::Value>,
        headers: &HashMap<String, String>,
        scan_type: &ScanType,
    ) -> SecurityScanResult {
        let start = Instant::now();
        let started_at = chrono::Utc::now().timestamp();
        let mut alerts = Vec::new();
        let mut requests_sent = 0u32;

        let payloads = get_payloads(scan_type);
        let leak_patterns = get_leak_patterns(scan_type);

        for payload in &payloads {
            for (param_name, _) in original_params {
                let mut test_params = original_params.clone();
                test_params.insert(param_name.clone(), serde_json::json!(payload));

                match self.send_request(url, method, &test_params, headers) {
                    Ok((status, body, response_time)) => {
                        requests_sent += 1;

                        // Check for vulnerability indicators
                        if let Some(alert) = self.analyze_response(
                            scan_type,
                            &leak_patterns,
                            status,
                            &body,
                            response_time,
                            payload,
                            param_name,
                        ) {
                            alerts.push(alert);
                        }
                    }
                    Err(e) => {
                        log::warn!("Request failed for payload {}: {}", payload, e);
                    }
                }
            }
        }

        let duration_ms = start.elapsed().as_millis() as u64;
        let status = if alerts.is_empty() {
            ScanStatus::Pass
        } else {
            ScanStatus::Fail
        };

        SecurityScanResult {
            id: uuid::Uuid::new_v4().to_string(),
            test_case_id: String::new(),
            scan_type: scan_type.clone(),
            status,
            requests_sent,
            alerts,
            duration_ms,
            started_at,
            completed_at: chrono::Utc::now().timestamp(),
        }
    }

    fn send_request(
        &self,
        url: &str,
        method: &str,
        params: &HashMap<String, serde_json::Value>,
        headers: &HashMap<String, String>,
    ) -> Result<(u16, String, u64), String> {
        let start = Instant::now();

        let mut req = match method.to_uppercase().as_str() {
            "GET" => self.client.get(url),
            "POST" => self.client.post(url),
            "PUT" => self.client.put(url),
            "DELETE" => self.client.delete(url),
            "PATCH" => self.client.patch(url),
            _ => return Err(format!("Unsupported method: {}", method)),
        };

        for (k, v) in headers {
            req = req.header(k, v);
        }

        if method != "GET" {
            req = req.json(params);
        }

        let response = req.send().map_err(|e| e.to_string())?;
        let status = response.status().as_u16();
        let body = response.text().unwrap_or_default();
        let response_time = start.elapsed().as_millis() as u64;

        Ok((status, body, response_time))
    }

    fn analyze_response(
        &self,
        scan_type: &ScanType,
        leak_patterns: &[&str],
        status: u16,
        body: &str,
        response_time: u64,
        payload: &str,
        param_name: &str,
    ) -> Option<SecurityAlert> {
        let body_lower = body.to_lowercase();

        // Check for error-based detection
        for pattern in leak_patterns {
            if body_lower.contains(&pattern.to_lowercase()) {
                return Some(SecurityAlert {
                    severity: AlertSeverity::High,
                    message: format!(
                        "{} vulnerability detected in parameter '{}': response contains '{}'",
                        scan_type.as_str(),
                        param_name,
                        pattern
                    ),
                    payload: payload.to_string(),
                    response_snippet: Some(body.chars().take(500).collect()),
                });
            }
        }

        // XSS reflection check
        if *scan_type == ScanType::XssInjection && body.contains(payload) {
            return Some(SecurityAlert {
                severity: AlertSeverity::High,
                message: format!(
                    "XSS payload reflected in response for parameter '{}'",
                    param_name
                ),
                payload: payload.to_string(),
                response_snippet: Some(body.chars().take(500).collect()),
            });
        }

        // Time-based SQL injection detection
        if *scan_type == ScanType::SqlInjection
            && payload.contains("WAITFOR")
            && response_time > 5000
        {
            return Some(SecurityAlert {
                severity: AlertSeverity::Critical,
                message: format!(
                    "Time-based SQL injection detected in parameter '{}': response delayed {}ms",
                    param_name, response_time
                ),
                payload: payload.to_string(),
                response_snippet: None,
            });
        }

        // Server error might indicate vulnerability
        if status >= 500 {
            return Some(SecurityAlert {
                severity: AlertSeverity::Medium,
                message: format!(
                    "Server error (HTTP {}) triggered by {} payload in parameter '{}'",
                    status,
                    scan_type.as_str(),
                    param_name
                ),
                payload: payload.to_string(),
                response_snippet: Some(body.chars().take(500).collect()),
            });
        }

        None
    }
}

pub fn run_security_test(
    test_case: &SecurityTestCase,
    url: &str,
    method: &str,
    params: &HashMap<String, serde_json::Value>,
    headers: &HashMap<String, String>,
) -> SecurityTestRun {
    let scanner = SecurityScanner::new();
    let started_at = chrono::Utc::now().timestamp();
    let mut results = Vec::new();
    let mut total_requests = 0u32;
    let mut total_alerts = 0u32;

    let enabled_scans: Vec<_> = test_case.scans.iter().filter(|s| s.enabled).collect();

    for scan_config in &enabled_scans {
        let mut result = scanner.run_scan(url, method, params, headers, &scan_config.scan_type);
        result.test_case_id = test_case.id.clone();
        total_requests += result.requests_sent;
        total_alerts += result.alerts.len() as u32;
        results.push(result);
    }

    let status = if results.iter().any(|r| r.status == ScanStatus::Fail) {
        ScanStatus::Fail
    } else {
        ScanStatus::Pass
    };

    SecurityTestRun {
        id: uuid::Uuid::new_v4().to_string(),
        test_case_id: test_case.id.clone(),
        status,
        total_scans: enabled_scans.len() as u32,
        completed_scans: results.len() as u32,
        total_requests,
        total_alerts,
        results,
        started_at,
        completed_at: Some(chrono::Utc::now().timestamp()),
    }
}
