use crate::types::{ApiRequest, ApiResponse};
use reqwest::blocking::Client;
use std::time::Instant;

pub fn execute_request(request: ApiRequest) -> Result<ApiResponse, String> {
    log::info!("[HTTP] Creating blocking client");
    let client = Client::new();
    let start = Instant::now();

    // Build URL
    let url = request.endpoint.clone();
    let method = request.method.clone();

    log::info!("[HTTP] Starting request: {} {}", method, url);
    log::debug!("[HTTP] Request endpoint: {}", url);

    // Build request
    let mut req_builder = match request.method.as_str() {
        "GET" => {
            log::debug!("[HTTP] Building GET request");
            client.get(&url)
        },
        "POST" => {
            log::debug!("[HTTP] Building POST request");
            client.post(&url)
        },
        "PUT" => {
            log::debug!("[HTTP] Building PUT request");
            client.put(&url)
        },
        "DELETE" => {
            log::debug!("[HTTP] Building DELETE request");
            client.delete(&url)
        },
        _ => {
            let error_msg = format!("Unsupported method: {}", request.method);
            log::error!("[HTTP] {}", error_msg);
            return Err(error_msg);
        },
    };

    // Add headers
    if let Some(headers) = &request.headers {
        log::debug!("[HTTP] Adding {} headers", headers.len());
        for (key, value) in headers {
            log::debug!("[HTTP] Header: {} = {}", key, value);
            req_builder = req_builder.header(key, value);
        }
    } else {
        log::debug!("[HTTP] No custom headers provided");
    }

    // Add JSON body for POST/PUT
    if request.method == "POST" || request.method == "PUT" {
        if !request.parameters.is_null() {
            log::debug!("[HTTP] Adding JSON body: {}", serde_json::to_string(&request.parameters).unwrap_or_else(|_| "invalid json".to_string()));
            req_builder = req_builder.json(&request.parameters);
        } else {
            log::debug!("[HTTP] No body provided for {} request", request.method);
        }
    }

    // Execute request
    log::info!("[HTTP] Sending request to {}", url);
    let send_start = Instant::now();
    
    let response = req_builder.send()
        .map_err(|e| {
            let error_msg = format!("Request failed: {}", e);
            let error_chain = get_error_chain(&e);
            let duration_before_failure = send_start.elapsed().as_millis();
            
            log::error!("[HTTP] Request failed: {} - URL: {}", error_msg, url);
            log::error!("[HTTP] Error chain: {}", error_chain);
            log::error!("[HTTP] Request duration before failure: {}ms", duration_before_failure);
            log::error!("[HTTP] Request method: {}", method);
            
            // Check specific error types
            if e.is_timeout() {
                log::error!("[HTTP] Error type: TIMEOUT - Request exceeded timeout limit");
            }
            if e.is_connect() {
                log::error!("[HTTP] Error type: CONNECTION - Failed to connect to server");
                log::error!("[HTTP] Possible causes: Server not running, wrong URL, network issue");
            }
            if e.is_request() {
                log::error!("[HTTP] Error type: REQUEST - Invalid request configuration");
            }
            if e.is_decode() {
                log::error!("[HTTP] Error type: DECODE - Failed to decode response");
            }
            
            // Log request context for debugging
            if let Some(headers) = &request.headers {
                log::debug!("[HTTP] Request headers at failure: {:?}", headers);
            }
            if !request.parameters.is_null() {
                log::debug!("[HTTP] Request body at failure: {:?}", request.parameters);
            }
            
            error_msg
        })?;

    let send_duration = send_start.elapsed().as_millis();
    log::info!("[HTTP] Request sent, waiting for response (took {}ms)", send_duration);

    let duration = start.elapsed().as_millis();
    let status = response.status().as_u16();
    let status_text = response.status().to_string();

    log::info!("[HTTP] Response received: {} {} (total: {}ms)", status, status_text, duration);

    // Extract headers
    let mut headers = std::collections::HashMap::new();
    for (key, value) in response.headers() {
        let header_value = value.to_str().unwrap_or("");
        log::debug!("[HTTP] Response header: {} = {}", key, header_value);
        headers.insert(
            key.to_string(),
            header_value.to_string()
        );
    }

    // Parse body
    log::debug!("[HTTP] Parsing response body");
    let parse_start = Instant::now();
    let data: serde_json::Value = response.json()
        .map_err(|e| {
            let error_msg = format!("Failed to parse response JSON: {}", e);
            log::error!("[HTTP] {}", error_msg);
            log::error!("[HTTP] Error chain: {}", get_error_chain(&e));
            error_msg
        })?;
    let parse_duration = parse_start.elapsed().as_millis();
    log::debug!("[HTTP] Body parsed in {}ms", parse_duration);

    if let Some(data_str) = data.to_string().get(0..200) {
        log::debug!("[HTTP] Response body preview (first 200 chars): {}", data_str);
    }

    log::info!("[HTTP] Request completed successfully: {} {} ({}ms)", method, url, duration);
    
    Ok(ApiResponse {
        status,
        status_text,
        data,
        headers,
        duration,
        timestamp: chrono::Utc::now().to_rfc3339(),
    })
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

pub fn generate_curl(url: &str, method: &str, body: Option<&serde_json::Value>) -> String {
    let mut curl = format!("curl -X {} '{}'", method, url);

    if let Some(body) = body {
        curl.push_str(&format!(" -H 'Content-Type: application/json' -d '{}'", body));
    }

    curl
}
