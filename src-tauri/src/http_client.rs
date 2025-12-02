use crate::types::{ApiRequest, ApiResponse};
use reqwest::blocking::Client;
use std::time::Instant;

pub fn execute_request(request: ApiRequest) -> Result<ApiResponse, String> {
    let client = Client::new();
    let start = Instant::now();

    // Build URL
    let url = request.endpoint;

    // Build request
    let mut req_builder = match request.method.as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        _ => return Err(format!("Unsupported method: {}", request.method)),
    };

    // Add headers
    if let Some(headers) = request.headers {
        for (key, value) in headers {
            req_builder = req_builder.header(key, value);
        }
    }

    // Add JSON body for POST/PUT
    if request.method == "POST" || request.method == "PUT" {
        req_builder = req_builder.json(&request.parameters);
    }

    // Execute request
    let response = req_builder.send()
        .map_err(|e| format!("Request failed: {}", e))?;

    let duration = start.elapsed().as_millis();
    let status = response.status().as_u16();
    let status_text = response.status().to_string();

    // Extract headers
    let mut headers = std::collections::HashMap::new();
    for (key, value) in response.headers() {
        headers.insert(
            key.to_string(),
            value.to_str().unwrap_or("").to_string()
        );
    }

    // Parse body
    let data: serde_json::Value = response.json()
        .unwrap_or(serde_json::Value::Null);

    Ok(ApiResponse {
        status,
        status_text,
        data,
        headers,
        duration,
        timestamp: chrono::Utc::now().to_rfc3339(),
    })
}

pub fn generate_curl(url: &str, method: &str, body: Option<&serde_json::Value>) -> String {
    let mut curl = format!("curl -X {} '{}'", method, url);

    if let Some(body) = body {
        curl.push_str(&format!(" -H 'Content-Type: application/json' -d '{}'", body));
    }

    curl
}
