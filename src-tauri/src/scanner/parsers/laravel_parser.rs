use crate::scanner::parsers::example_generator::ExampleGenerator;
use crate::scanner::types::{
    Authentication, Authorization, BusinessLogic, EndpointParameter, ScannedEndpoint,
};
use glob::glob;
use log::{debug, error, info, warn};
use regex::Regex;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

pub struct LaravelParser {
    project_path: PathBuf,
    endpoint_metadata: HashMap<String, EndpointMetadata>,
    controller_files_cache: HashMap<String, String>,
    form_request_files_cache: HashMap<String, String>,
}

struct EndpointMetadata {
    controller_class: String,
    method_name: String,
}

impl LaravelParser {
    pub fn new(project_path: PathBuf) -> Self {
        Self {
            project_path,
            endpoint_metadata: HashMap::new(),
            controller_files_cache: HashMap::new(),
            form_request_files_cache: HashMap::new(),
        }
    }

    pub async fn parse_endpoints(&mut self) -> Result<Vec<ScannedEndpoint>, String> {
        let mut endpoints = Vec::new();

        // Step 1: Parse routes files
        let routes_endpoints = self.parse_routes_files().await?;
        endpoints.extend(routes_endpoints);

        // Step 2: Build controller files cache
        self.build_controller_files_cache().await?;

        // Step 2.5: Build FormRequest files cache
        self.build_form_request_files_cache().await?;

        // Step 3: Enhance endpoints with parameters from controllers
        for endpoint in &mut endpoints {
            self.enhance_endpoint_with_parameters(endpoint).await?;
        }

        // Step 4: Remove duplicates
        let unique_endpoints = self.deduplicate_endpoints(endpoints);

        Ok(unique_endpoints)
    }

    async fn parse_routes_files(&mut self) -> Result<Vec<ScannedEndpoint>, String> {
        let mut endpoints = Vec::new();

        let routes_patterns = vec![
            "routes/api.php",
            "routes/web.php",
            "routes/*.php",
        ];

        for pattern in routes_patterns {
            // Build glob pattern relative to project path
            let pattern_str = if pattern.contains('*') {
                // For wildcard patterns, use glob directly
                format!("{}/{}", self.project_path.to_string_lossy(), pattern)
            } else {
                // For specific files, check if exists
                let full_path = self.project_path.join(pattern);
                if full_path.exists() {
                    full_path.to_string_lossy().to_string()
                } else {
                    continue;
                }
            };

            if let Ok(entries) = glob(&pattern_str) {
                for entry in entries.flatten() {
                    if let Ok(content) = fs::read_to_string(&entry) {
                        let file_endpoints = self.parse_routes_content(&content, &entry)?;
                        endpoints.extend(file_endpoints);
                    }
                }
            }
        }

        Ok(endpoints)
    }

    fn parse_routes_content(
        &mut self,
        content: &str,
        file_path: &Path,
    ) -> Result<Vec<ScannedEndpoint>, String> {
        let mut endpoints = Vec::new();

        // Pattern 1: Route::get('path', [Controller::class, 'method'])
        let route_patterns = vec![
            (r#"Route::get\s*\(\s*['"]([^'"]+)['"]\s*,\s*\[\s*([\w\\]+)::class\s*,\s*['"]([^'"]+)['"]\s*\]\s*\)"#, "GET"),
            (r#"Route::post\s*\(\s*['"]([^'"]+)['"]\s*,\s*\[\s*([\w\\]+)::class\s*,\s*['"]([^'"]+)['"]\s*\]\s*\)"#, "POST"),
            (r#"Route::put\s*\(\s*['"]([^'"]+)['"]\s*,\s*\[\s*([\w\\]+)::class\s*,\s*['"]([^'"]+)['"]\s*\]\s*\)"#, "PUT"),
            (r#"Route::patch\s*\(\s*['"]([^'"]+)['"]\s*,\s*\[\s*([\w\\]+)::class\s*,\s*['"]([^'"]+)['"]\s*\]\s*\)"#, "PATCH"),
            (r#"Route::delete\s*\(\s*['"]([^'"]+)['"]\s*,\s*\[\s*([\w\\]+)::class\s*,\s*['"]([^'"]+)['"]\s*\]\s*\)"#, "DELETE"),
        ];

        for (pattern, method) in route_patterns {
            if let Ok(re) = Regex::new(pattern) {
                for cap in re.captures_iter(content) {
                    if let (Some(path_match), Some(controller_match), Some(action_match)) =
                        (cap.get(1), cap.get(2), cap.get(3))
                    {
                        let route_path = path_match.as_str();
                        let controller_class = controller_match.as_str();
                        let method_name = action_match.as_str();

                        let endpoint = self.create_endpoint(
                            route_path,
                            method,
                            controller_class,
                            method_name,
                            file_path,
                        )?;

                        // Store metadata
                        let key = format!("{}:{}", method, route_path);
                        self.endpoint_metadata.insert(
                            key,
                            EndpointMetadata {
                                controller_class: controller_class.to_string(),
                                method_name: method_name.to_string(),
                            },
                        );

                        endpoints.push(endpoint);
                    }
                }
            }
        }

        // Pattern 2: Route::resource('resource', Controller::class)
        let resource_patterns = vec![
            (r#"Route::resource\s*\(\s*['"]([^'"]+)['"]\s*,\s*([\w\\]+)::class\s*\)"#, false),
            (r#"Route::apiResource\s*\(\s*['"]([^'"]+)['"]\s*,\s*([\w\\]+)::class\s*\)"#, true),
        ];

        for (pattern, is_api) in resource_patterns {
            if let Ok(re) = Regex::new(pattern) {
                for cap in re.captures_iter(content) {
                    if let (Some(resource_match), Some(controller_match)) =
                        (cap.get(1), cap.get(2))
                    {
                        let resource_path = resource_match.as_str();
                        let controller_class = controller_match.as_str();

                        let resource_endpoints =
                            self.generate_resource_endpoints(resource_path, controller_class, is_api)?;
                        endpoints.extend(resource_endpoints);
                    }
                }
            }
        }

        Ok(endpoints)
    }

    fn generate_resource_endpoints(
        &mut self,
        resource_path: &str,
        controller_class: &str,
        is_api: bool,
    ) -> Result<Vec<ScannedEndpoint>, String> {
        let mut endpoints = Vec::new();
        let base_path = if resource_path.starts_with('/') {
            resource_path.to_string()
        } else {
            format!("/{}", resource_path)
        };

        let resource_actions = if is_api {
            vec![
                ("GET", "index", base_path.clone()),
                ("POST", "store", base_path.clone()),
                ("GET", "show", format!("{}/{{id}}", base_path)),
                ("PUT", "update", format!("{}/{{id}}", base_path)),
                ("PATCH", "update", format!("{}/{{id}}", base_path)),
                ("DELETE", "destroy", format!("{}/{{id}}", base_path)),
            ]
        } else {
            vec![
                ("GET", "index", base_path.clone()),
                ("GET", "create", format!("{}/create", base_path)),
                ("POST", "store", base_path.clone()),
                ("GET", "show", format!("{}/{{id}}", base_path)),
                ("GET", "edit", format!("{}/{{id}}/edit", base_path)),
                ("PUT", "update", format!("{}/{{id}}", base_path)),
                ("PATCH", "update", format!("{}/{{id}}", base_path)),
                ("DELETE", "destroy", format!("{}/{{id}}", base_path)),
            ]
        };

        for (method, action, path) in resource_actions {
            let endpoint = self.create_endpoint(
                &path,
                method,
                controller_class,
                action,
                Path::new(""),
            )?;

            // Store metadata
            let key = format!("{}:{}", method, path);
            self.endpoint_metadata.insert(
                key,
                EndpointMetadata {
                    controller_class: controller_class.to_string(),
                    method_name: action.to_string(),
                },
            );

            endpoints.push(endpoint);
        }

        Ok(endpoints)
    }

    async fn build_controller_files_cache(&mut self) -> Result<(), String> {
        let pattern_str = format!("{}/**/app/Http/Controllers/**/*.php", self.project_path.to_string_lossy());

        if let Ok(entries) = glob(&pattern_str) {
            for entry in entries.flatten() {
                if let Ok(content) = fs::read_to_string(&entry) {
                    if let Some(controller_class) = self.extract_controller_class(&content, &entry) {
                        self.controller_files_cache
                            .insert(controller_class, entry.to_string_lossy().to_string());
                    }
                }
            }
        }

        Ok(())
    }

    async fn build_form_request_files_cache(&mut self) -> Result<(), String> {
        let pattern_str = format!("{}/**/app/Http/Requests/**/*.php", self.project_path.to_string_lossy());

        if let Ok(entries) = glob(&pattern_str) {
            for entry in entries.flatten() {
                if let Ok(content) = fs::read_to_string(&entry) {
                    if let Some(form_request_class) = self.extract_form_request_class(&content) {
                        let file_path = entry.to_string_lossy().to_string();
                        
                        // Store with full namespace
                        self.form_request_files_cache
                            .insert(form_request_class.clone(), file_path.clone());
                        
                        // Also store with simple class name for lookup
                        if let Some(simple_name) = form_request_class.split('\\').last() {
                            self.form_request_files_cache
                                .insert(simple_name.to_string(), file_path);
                        }
                    }
                }
            }
        }

        Ok(())
    }

    fn extract_form_request_class(&self, content: &str) -> Option<String> {
        // Try with namespace first
        let namespace_re = Regex::new(r"namespace\s+([\w\\]+);").ok()?;
        let class_re = Regex::new(r"class\s+(\w+Request)\s+extends").ok()?;

        if let (Some(namespace_cap), Some(class_cap)) =
            (namespace_re.captures(content), class_re.captures(content))
        {
            if let (Some(namespace_match), Some(class_match)) =
                (namespace_cap.get(1), class_cap.get(1))
            {
                return Some(format!("{}\\{}", namespace_match.as_str(), class_match.as_str()));
            }
        }

        // Fallback: just class name without namespace
        if let Some(class_cap) = class_re.captures(content) {
            if let Some(class_match) = class_cap.get(1) {
                return Some(class_match.as_str().to_string());
            }
        }

        None
    }

    fn extract_controller_class(&self, content: &str, _file_path: &Path) -> Option<String> {
        // Try with namespace first (most common in Laravel)
        let namespace_re = Regex::new(r"namespace\s+([\w\\]+);").ok()?;
        let class_re = Regex::new(r"class\s+(\w+Controller)\s+extends").ok()?;

        if let (Some(namespace_cap), Some(class_cap)) =
            (namespace_re.captures(content), class_re.captures(content))
        {
            if let (Some(namespace_match), Some(class_match)) =
                (namespace_cap.get(1), class_cap.get(1))
            {
                return Some(format!("{}\\{}", namespace_match.as_str(), class_match.as_str()));
            }
        }

        // Fallback: just class name without namespace
        if let Some(class_cap) = class_re.captures(content) {
            if let Some(class_match) = class_cap.get(1) {
                return Some(class_match.as_str().to_string());
            }
        }

        None
    }

    async fn enhance_endpoint_with_parameters(
        &self,
        endpoint: &mut ScannedEndpoint,
    ) -> Result<(), String> {
        let key = format!("{}:{}", endpoint.method, endpoint.path);
        let metadata = match self.endpoint_metadata.get(&key) {
            Some(m) => m,
            None => return Ok(()),
        };

        // Find controller file
        let controller_file_path = self
            .controller_files_cache
            .get(&metadata.controller_class)
            .cloned();

        if let Some(file_path) = controller_file_path {
            if let Ok(controller_content) = fs::read_to_string(&file_path) {
                // Extract path parameters from route path
                let path_params = self.parse_path_parameters(&endpoint.path);
                endpoint.parameters.extend(path_params);

                // Try to extract parameters from controller method
                match self.extract_method_parameters(&controller_content, &metadata.method_name, &endpoint.method).await {
                    Ok(method_params) => {
                        endpoint.parameters.extend(method_params);
                    }
                    Err(_) => {
                        // Continue if extraction fails
                    }
                }
            }
        }

        Ok(())
    }

    fn parse_path_parameters(&self, path: &str) -> Vec<EndpointParameter> {
        let mut params = Vec::new();
        // Laravel path parameter pattern: {id}, {id?}, {id:\d+}
        let param_re = Regex::new(r"\{(\w+)(\?)?(?::([^}]+))?\}").ok();

        if let Some(re) = param_re {
            for cap in re.captures_iter(path) {
                if let Some(name_match) = cap.get(1) {
                    let name = name_match.as_str();
                    let is_optional = cap.get(2).is_some();
                    let constraint = cap.get(3).map(|m| m.as_str().to_string());

                    let param_type = if let Some(ref c) = constraint {
                        if c.contains("\\d+") || c.contains("int") {
                            "number"
                        } else {
                            "string"
                        }
                    } else {
                        "string"
                    };

                    let validation = constraint.map(|c| vec![c]);
                    let example = ExampleGenerator::generate_example(param_type, name, &validation);
                    let default_value = ExampleGenerator::generate_default(param_type);

                    params.push(EndpointParameter {
                        name: name.to_string(),
                        param_type: param_type.to_string(),
                        source: "path".to_string(),
                        required: !is_optional,
                        validation,
                        example,
                        default_value,
                    });
                }
            }
        }

        params
    }

    async fn extract_method_parameters(
        &self,
        controller_content: &str,
        method_name: &str,
        http_method: &str,
    ) -> Result<Vec<EndpointParameter>, String> {
        // Find method signature: public function methodName(...)
        let method_pattern = format!(r"public\s+function\s+{}\s*\(([^)]*)\)", method_name);
        let method_re = match Regex::new(&method_pattern) {
            Ok(re) => re,
            Err(_) => return Ok(Vec::new()),
        };

        let method_params_str = match method_re.captures(controller_content) {
            Some(cap) => cap.get(1).map(|m| m.as_str()).unwrap_or(""),
            None => return Ok(Vec::new()),
        };

        // Extract parameters from method signature
        // Pattern: Request $request, int $id, StoreUserRequest $request, etc.
        let param_re = match Regex::new(r"([\w\\]+)\s+\$(\w+)") {
            Ok(re) => re,
            Err(_) => return Ok(Vec::new()),
        };

        let mut params = Vec::new();

        for cap in param_re.captures_iter(method_params_str) {
            if let (Some(type_match), Some(name_match)) = (cap.get(1), cap.get(2)) {
                let param_type_str = type_match.as_str();
                let param_name = name_match.as_str();

                // Check if this is a FormRequest class
                if param_type_str.ends_with("Request") && param_type_str != "Request" {
                    // Try to extract FormRequest class name
                    if let Some(form_request_class) = self.extract_form_request_class_name(param_type_str) {
                        // Parse FormRequest to get body parameters
                        match self.parse_form_request(&form_request_class).await {
                            Ok(form_params) => {
                                params.extend(form_params);
                                continue;
                            }
                            Err(_) => {
                                // If parsing fails, fall through to default handling
                            }
                        }
                    }
                }

                // Default parameter handling for non-FormRequest types
                let (api_type, source) = if param_type_str.contains("Request") {
                    ("object", "body")
                } else if param_type_str.contains("int") || param_type_str.contains("float") {
                    ("number", "body")
                } else if param_type_str.contains("bool") {
                    ("boolean", "body")
                } else {
                    ("string", "body")
                };

                let example = ExampleGenerator::generate_example(api_type, param_name, &None);
                let default_value = ExampleGenerator::generate_default(api_type);

                params.push(EndpointParameter {
                    name: param_name.to_string(),
                    param_type: api_type.to_string(),
                    source: source.to_string(),
                    required: true,
                    validation: None,
                    example,
                    default_value,
                });
            }
        }

        // Also try to extract inline validation from $request->validate() calls
        let inline_params = self.extract_inline_validation(controller_content, method_name);
        debug!("extract_method_parameters: inline_params count: {}", inline_params.len());
        params.extend(inline_params);

        // Extract parameters from $request->filled() patterns
        let filled_params = self.extract_request_filled_parameters(controller_content, method_name, http_method);
        debug!("extract_method_parameters: filled_params count: {}", filled_params.len());
        params.extend(filled_params);

        info!("extract_method_parameters: total params: {}", params.len());
        Ok(params)
    }

    /// Extract inline validation from $request->validate() calls
    fn extract_inline_validation(
        &self,
        controller_content: &str,
        method_name: &str,
    ) -> Vec<EndpointParameter> {
        let mut params = Vec::new();

        // Find method body
        let method_pattern = format!(
            r"public\s+function\s+{}\s*\([^)]*\)\s*{{([\s\S]*?)\n\s*}}",
            method_name
        );
        let method_re = match Regex::new(&method_pattern) {
            Ok(re) => re,
            Err(_) => return params,
        };

        let method_body = match method_re.captures(controller_content) {
            Some(cap) => cap.get(1).map(|m| m.as_str()).unwrap_or(""),
            None => return params,
        };

        // Find $request->validate() calls
        let validate_pattern = r"\$request->validate\s*\(\s*\[([\s\S]*?)\]\s*\)";
        let validate_re = match Regex::new(validate_pattern) {
            Ok(re) => re,
            Err(_) => return params,
        };

        for cap in validate_re.captures_iter(method_body) {
            if let Some(rules_str) = cap.get(1) {
                // Create a temporary rules() method format to reuse extract_validation_rules
                let temp_content = format!("public function rules() {{\nreturn [{}];\n}}", rules_str.as_str());
                let validation_rules = self.extract_validation_rules(&temp_content);

                for (field_name, rules) in validation_rules {
                    let param = self.parse_validation_rule(&field_name, &rules);
                    params.push(param);
                }
            }
        }

        params
    }

    /// Extract parameters from $request->filled() patterns in controller method body
    fn extract_request_filled_parameters(
        &self,
        controller_content: &str,
        method_name: &str,
        http_method: &str,
    ) -> Vec<EndpointParameter> {
        let mut params = Vec::new();
        let mut seen_params = std::collections::HashSet::new();

        debug!("extract_request_filled_parameters: method_name={}, http_method={}", method_name, http_method);

        // Find method body - improved pattern to handle multiline methods with nested braces
        let method_pattern = format!(
            r"public\s+function\s+{}\s*\([^)]*\)\s*{{",
            method_name
        );
        let method_start_re = match Regex::new(&method_pattern) {
            Ok(re) => re,
            Err(e) => {
                error!("Failed to create method start regex: {:?}", e);
                return params;
            }
        };

        // Find method start position
        let method_body = match method_start_re.find(controller_content) {
            Some(m) => {
                let start_pos = m.end();
                // Find matching closing brace
                let mut depth = 1;
                let mut pos = start_pos;
                let chars: Vec<char> = controller_content.chars().collect();
                let mut in_string = false;
                let mut string_char = '\0';
                
                while pos < chars.len() && depth > 0 {
                    let ch = chars[pos];
                    
                    // Handle string literals
                    if !in_string && (ch == '"' || ch == '\'') {
                        in_string = true;
                        string_char = ch;
                    } else if in_string {
                        if ch == string_char && (pos == 0 || chars[pos - 1] != '\\') {
                            in_string = false;
                        }
                    } else {
                        if ch == '{' {
                            depth += 1;
                        } else if ch == '}' {
                            depth -= 1;
                        }
                    }
                    
                    pos += 1;
                }
                
                if depth == 0 {
                    let body = &controller_content[start_pos..pos - 1];
                    debug!("Found method body, length: {}", body.len());
                    if body.len() > 0 {
                        debug!("Method body preview (first 200 chars): {}", &body[..body.len().min(200)]);
                    }
                    body
                } else {
                    warn!("Failed to find matching closing brace for method: {}", method_name);
                    return params;
                }
            }
            None => {
                debug!("Method start not found for method: {}", method_name);
                return params;
            }
        };

        // Determine source based on HTTP method
        let source = if http_method == "GET" {
            "query"
        } else {
            "body"
        };
        debug!("Determined source: {} (http_method: {})", source, http_method);

        // Pattern 1: if ($request->filled('paramName'))
        let filled_pattern = r#"if\s*\(\s*\$request->filled\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)"#;
        let filled_re = match Regex::new(filled_pattern) {
            Ok(re) => re,
            Err(e) => {
                error!("Failed to create filled pattern regex: {:?}", e);
                return params;
            }
        };

        let mut match_count = 0;
        for cap in filled_re.captures_iter(method_body) {
            match_count += 1;
            if let Some(param_name_match) = cap.get(1) {
                let param_name = param_name_match.as_str();
                debug!("Found filled() check for param: {}", param_name);
                
                // Skip if already seen
                if seen_params.contains(param_name) {
                    debug!("Skipping duplicate param: {}", param_name);
                    continue;
                }
                seen_params.insert(param_name.to_string());

                // Find the block after this filled() check to extract more info
                let match_end = cap.get(0).unwrap().end();
                let remaining = &method_body[match_end..];
                
                // Skip whitespace
                let whitespace_end = remaining
                    .chars()
                    .take_while(|c| c.is_whitespace())
                    .count();
                
                let after_whitespace = &remaining[whitespace_end..];
                
                // Check if there's an opening brace (multi-line block) or it's a single statement
                let (block_start_offset, has_brace) = if after_whitespace.starts_with('{') {
                    (whitespace_end + 1, true)
                } else {
                    (whitespace_end, false)
                };
                
                let block_content_start = match_end + block_start_offset;
                let block_content_str = &method_body[block_content_start..];
                
                // Find the end of the block
                let block_end = if has_brace {
                    // Multi-line block: find matching closing brace
                    let mut depth = 1;
                    let mut pos = 0;
                    let chars: Vec<char> = block_content_str.chars().collect();
                    let mut in_string = false;
                    let mut string_char = '\0';
                    
                    while pos < chars.len() && depth > 0 {
                        let ch = chars[pos];
                        
                        // Handle string literals
                        if !in_string && (ch == '"' || ch == '\'') {
                            in_string = true;
                            string_char = ch;
                        } else if in_string {
                            if ch == string_char && (pos == 0 || chars[pos - 1] != '\\') {
                                in_string = false;
                            }
                        } else {
                            if ch == '{' {
                                depth += 1;
                            } else if ch == '}' {
                                depth -= 1;
                            }
                        }
                        
                        pos += 1;
                    }
                    
                    if depth == 0 {
                        pos - 1 // Exclude the closing brace
                    } else {
                        block_content_str.len() // Fallback to full length
                    }
                } else {
                    // Single statement: find end of statement (semicolon or next if/else)
                    self.find_block_end(block_content_str)
                };
                
                let block_content = &method_body[block_content_start..block_content_start + block_end];
                
                debug!("Extracted block content for {} (length: {}, has_brace: {}): {}", 
                    param_name, block_content.len(), has_brace,
                    &block_content[..block_content.len().min(100)]);

                // Extract parameter details from the block
                let param = self.parse_filled_parameter_block(param_name, block_content, source);
                debug!("Created param: name={}, type={}, source={}, required={}", 
                    param.name, param.param_type, param.source, param.required);
                params.push(param);
            }
        }
        
        info!("Total filled() matches found: {}, params extracted: {}", match_count, params.len());
        params
    }

    /// Find the end of a code block (handles nested braces and statements)
    fn find_block_end(&self, content: &str) -> usize {
        let mut depth = 0;
        let mut in_string = false;
        let mut string_char = '\0';
        let mut i = 0;
        let chars: Vec<char> = content.chars().collect();
        let mut started = false;

        while i < chars.len() {
            let ch = chars[i];
            
            // Handle string literals
            if !in_string && (ch == '"' || ch == '\'') {
                in_string = true;
                string_char = ch;
                i += 1;
                continue;
            }
            
            if in_string {
                if ch == string_char && (i == 0 || chars[i - 1] != '\\') {
                    in_string = false;
                }
                i += 1;
                continue;
            }

            // Skip initial whitespace
            if !started && ch.is_whitespace() {
                i += 1;
                continue;
            }
            started = true;

            // Handle braces
            if ch == '{' {
                depth += 1;
            } else if ch == '}' {
                if depth == 0 {
                    return i;
                }
                depth -= 1;
            } else if depth == 0 {
                // Check for end of statement (semicolon not inside braces)
                if ch == ';' {
                    // Find the end of this statement (skip to next non-whitespace or end)
                    let mut j = i + 1;
                    while j < chars.len() && chars[j].is_whitespace() {
                        j += 1;
                    }
                    return j;
                }
                // Check for next if/else/elseif (new conditional block)
                if i + 1 < chars.len() {
                    let next_chars: String = chars[i..i.min(i + 6)].iter().collect();
                    if next_chars.starts_with("if ") || next_chars.starts_with("else") {
                        return i;
                    }
                }
            }

            i += 1;
        }

        content.len()
    }

    /// Parse a block after $request->filled() to extract parameter details
    fn parse_filled_parameter_block(
        &self,
        param_name: &str,
        block_content: &str,
        source: &str,
    ) -> EndpointParameter {
        let mut param_type = "string";
        let mut validation = None;

        // Escape special regex characters in param_name
        let escaped_param = param_name.replace(r"\", r"\\").replace(".", r"\.").replace("(", r"\(").replace(")", r"\)").replace("[", r"\[").replace("]", r"\]").replace("{", r"\{").replace("}", r"\}").replace("+", r"\+").replace("*", r"\*").replace("?", r"\?").replace("^", r"\^").replace("$", r"\$").replace("|", r"\|");

        // Pattern 1: Check for whereIn() - indicates array parameter
        let where_in_pattern = format!(r#"whereIn\s*\(\s*['"]?[^'"]*['"]?\s*,\s*\$request->input\s*\(\s*['"]{}['"]\s*\)"#, escaped_param);
        if Regex::new(&where_in_pattern).ok().and_then(|re| re.captures(block_content)).is_some() {
            param_type = "array";
        }

        // Pattern 2: Check for foreach with sorts - indicates array parameter
        if block_content.contains("foreach") && block_content.contains("sorts") {
            param_type = "array";
        }

        // Pattern 3: $request->enum('paramName', EnumClass::class)
        let enum_pattern = format!(r#"\$request->enum\s*\(\s*['"]{}['"]\s*,\s*([\w\\]+)::class\s*\)"#, escaped_param);
        if let Ok(enum_re) = Regex::new(&enum_pattern) {
            if let Some(enum_cap) = enum_re.captures(block_content) {
                if let Some(enum_class) = enum_cap.get(1) {
                    param_type = "string";
                    validation = Some(vec![format!("enum:{}", enum_class.as_str())]);
                }
            }
        }

        // Pattern 4: $request->date('paramName')
        let date_pattern = format!(r#"\$request->date\s*\(\s*['"]{}['"]\s*\)"#, escaped_param);
        if Regex::new(&date_pattern).ok().and_then(|re| re.captures(block_content)).is_some() {
            param_type = "string";
            validation = Some(vec!["date".to_string()]);
        }

        // Pattern 5: $request->input('paramName')
        let input_pattern = format!(r#"\$request->input\s*\(\s*['"]{}['"]\s*\)"#, escaped_param);
        
        // Check for operators and determine type
        if let Ok(input_re) = Regex::new(&input_pattern) {
            if input_re.is_match(block_content) {
                // Check for LIKE operator (string with pattern matching)
                if block_content.contains("LIKE") || block_content.contains("like") {
                    param_type = "string";
                    if validation.is_none() {
                        validation = Some(vec!["like".to_string()]);
                    }
                }
                // Check for comparison operators
                else if block_content.contains(">=") || block_content.contains("<=") || block_content.contains(">") || block_content.contains("<") {
                    // Check if comparing with numeric values or dates
                    let numeric_pattern = r#"(>=|<=|>|<)\s*['"]?(\d+(?:\.\d+)?)['"]?"#;
                    let date_pattern_check = r#"(>=|<=|>|<)\s*\$request->(?:input|date)"#;
                    
                    if Regex::new(date_pattern_check).ok().and_then(|re| re.captures(block_content)).is_some() {
                        // Date comparison
                        param_type = "string";
                        if validation.is_none() {
                            validation = Some(vec!["date".to_string()]);
                        }
                    } else if Regex::new(numeric_pattern).ok().and_then(|re| re.captures(block_content)).is_some() {
                        // Numeric comparison
                        param_type = "number";
                    }
                }
                // Check for exact match (could be number or string)
                else if block_content.contains("where") && !block_content.contains("LIKE") {
                    // Try to infer type from context
                    // If param name contains "Id", "id", "amount", "price" etc, likely number
                    let lower_name = param_name.to_lowercase();
                    if lower_name.contains("id") || lower_name.contains("amount") || lower_name.contains("price") || lower_name.contains("count") || lower_name.contains("quantity") {
                        param_type = "number";
                    }
                }
            }
        }

        // Pattern 6: Check for whereHas pattern (usually indicates nested/related data)
        if block_content.contains("whereHas") {
            // This is a complex query, keep as string for now
            param_type = "string";
        }

        // Pattern 7: Check for endOfDay() - indicates date parameter
        if block_content.contains("endOfDay") || block_content.contains("end_of_day") {
            param_type = "string";
            validation = Some(vec!["date".to_string()]);
        }

        let example = ExampleGenerator::generate_example(param_type, param_name, &validation);
        let default_value = ExampleGenerator::generate_default(param_type);

        EndpointParameter {
            name: param_name.to_string(),
            param_type: param_type.to_string(),
            source: source.to_string(),
            required: false, // Parameters from filled() are always optional
            validation,
            example,
            default_value,
        }
    }

    fn create_endpoint(
        &self,
        route_path: &str,
        method: &str,
        controller_class: &str,
        action: &str,
        file_path: &Path,
    ) -> Result<ScannedEndpoint, String> {
        let controller_name = controller_class
            .split('\\')
            .last()
            .unwrap_or(controller_class)
            .to_string();

        // Normalize path to ensure it starts with /
        let normalized_path = if route_path.starts_with('/') {
            route_path.to_string()
        } else {
            format!("/{}", route_path)
        };

        Ok(ScannedEndpoint {
            path: normalized_path.clone(),
            method: method.to_string(),
            controller: controller_name.clone(),
            action: action.to_string(),
            file_path: file_path.to_string_lossy().to_string(),
            line_number: 0,
            parameters: Vec::new(),
            business_logic: BusinessLogic {
                summary: format!("{} {}", method, normalized_path),
                description: format!("{}@{}", controller_name, action),
                purpose: String::new(),
                dependencies: Vec::new(),
            },
            authentication: Authentication::default(),
            authorization: Authorization::default(),
            responses: Vec::new(),
        })
    }

    fn deduplicate_endpoints(&self, endpoints: Vec<ScannedEndpoint>) -> Vec<ScannedEndpoint> {
        let mut seen = HashMap::new();

        for endpoint in endpoints {
            let key = format!("{}:{}", endpoint.method, endpoint.path);
            if !seen.contains_key(&key) {
                seen.insert(key, endpoint);
            }
        }

        seen.into_values().collect()
    }

    /// Extract validation rules from FormRequest content
    fn extract_validation_rules(&self, form_request_content: &str) -> HashMap<String, Vec<String>> {
        let mut rules = HashMap::new();

        // Find rules() method
        let rules_method_pattern = r"public\s+function\s+rules\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}";
        let rules_re = match Regex::new(rules_method_pattern) {
            Ok(re) => re,
            Err(_) => return rules,
        };

        let rules_body = match rules_re.captures(form_request_content) {
            Some(cap) => cap.get(1).map(|m| m.as_str()).unwrap_or(""),
            None => return rules,
        };

        // Pattern 1: 'field_name' => 'required|string|max:255'
        // Pattern 2: 'field_name' => ['required', 'string', 'max:255']
        let field_pattern = r#"['"]([^'"]+)['"]\s*=>\s*(['"]([^'"]+)['"]|\[([^\]]+)\])"#;
        let field_re = match Regex::new(field_pattern) {
            Ok(re) => re,
            Err(_) => return rules,
        };

        for cap in field_re.captures_iter(rules_body) {
            if let Some(field_name_match) = cap.get(1) {
                let field_name = field_name_match.as_str().to_string();
                let rule_string = cap.get(3).map(|m| m.as_str());
                let rule_array = cap.get(4).map(|m| m.as_str());

                let rule_list = if let Some(rule_str) = rule_string {
                    // String format: 'required|string|max:255'
                    rule_str.split('|').map(|s| s.trim().to_string()).collect()
                } else if let Some(rule_arr) = rule_array {
                    // Array format: ['required', 'string', 'max:255']
                    rule_arr
                        .split(',')
                        .map(|s| s.trim().trim_matches('\'').trim_matches('"').to_string())
                        .collect()
                } else {
                    continue;
                };

                rules.insert(field_name, rule_list);
            }
        }

        rules
    }

    /// Parse FormRequest class to extract body parameters from validation rules
    async fn parse_form_request(
        &self,
        form_request_class: &str,
    ) -> Result<Vec<EndpointParameter>, String> {
        let mut flat_params = Vec::new();

        // Find FormRequest file
        let form_request_file_path = self
            .form_request_files_cache
            .get(form_request_class)
            .cloned();

        if let Some(file_path) = form_request_file_path {
            if let Ok(form_request_content) = fs::read_to_string(&file_path) {
                let validation_rules = self.extract_validation_rules(&form_request_content);

                for (field_name, rules) in validation_rules {
                    let param = self.parse_validation_rule(&field_name, &rules);
                    flat_params.push(param);
                }
            }
        }

        // Group nested fields and build nested structure
        let parameters = self.build_nested_parameters(flat_params);

        Ok(parameters)
    }

    /// Build nested parameters from flat field names (e.g., "user.name" -> nested structure)
    fn build_nested_parameters(&self, flat_params: Vec<EndpointParameter>) -> Vec<EndpointParameter> {
        let mut nested_map: HashMap<String, Vec<EndpointParameter>> = HashMap::new();
        let mut top_level_params = Vec::new();

        for param in flat_params {
            let field_name = &param.name;
            
            // Check if this is a nested field (contains dot)
            if field_name.contains('.') {
                let parts: Vec<&str> = field_name.split('.').collect();
                if let Some(parent) = parts.first() {
                    let child_name = parts[1..].join(".");
                    let mut child_param = param.clone();
                    child_param.name = child_name;
                    
                    nested_map
                        .entry(parent.to_string())
                        .or_insert_with(Vec::new)
                        .push(child_param);
                }
            } else {
                top_level_params.push(param);
            }
        }

        // Convert nested map to nested parameters
        for (parent_name, children) in nested_map {
            let nested_children = self.build_nested_parameters(children);
            
            // Build nested object example
            let mut nested_obj = serde_json::Map::new();
            for child in &nested_children {
                if let Some(ref example) = child.example {
                    nested_obj.insert(child.name.clone(), example.clone());
                }
            }
            
            let example = if nested_obj.is_empty() {
                Some(Value::Object(serde_json::Map::new()))
            } else {
                Some(Value::Object(nested_obj))
            };

            top_level_params.push(EndpointParameter {
                name: parent_name,
                param_type: "object".to_string(),
                source: "body".to_string(),
                required: true,
                validation: None,
                example,
                default_value: Some(Value::Object(serde_json::Map::new())),
            });
        }

        top_level_params
    }

    /// Extract class name from type hint (e.g., "StoreUserRequest" from "App\Http\Requests\StoreUserRequest")
    fn extract_form_request_class_name(&self, type_hint: &str) -> Option<String> {
        // Remove leading backslashes and extract class name
        let class_name = type_hint.trim_start_matches('\\');
        
        // Extract just the class name (last part after \)
        if let Some(last_part) = class_name.split('\\').last() {
            if last_part.ends_with("Request") {
                return Some(last_part.to_string());
            }
        }

        // If no namespace, check if it's already just the class name
        if type_hint.ends_with("Request") {
            return Some(type_hint.to_string());
        }

        None
    }

    /// Parse validation rule into EndpointParameter
    fn parse_validation_rule(
        &self,
        field_name: &str,
        rules: &[String],
    ) -> EndpointParameter {
        let mut param_type = "string";
        let mut required = true;
        let mut validation_rules = Vec::new();

        for rule in rules {
            let rule_trimmed = rule.trim();

            if rule_trimmed == "required" {
                required = true;
                validation_rules.push(rule_trimmed.to_string());
            } else if rule_trimmed == "nullable" || rule_trimmed == "sometimes" {
                required = false;
                validation_rules.push(rule_trimmed.to_string());
            } else if rule_trimmed == "string" {
                param_type = "string";
                validation_rules.push("string".to_string());
            } else if rule_trimmed == "integer" || rule_trimmed == "int" {
                param_type = "number";
                validation_rules.push("integer".to_string());
            } else if rule_trimmed == "numeric" || rule_trimmed == "float" || rule_trimmed == "double" {
                param_type = "number";
                validation_rules.push("numeric".to_string());
            } else if rule_trimmed == "boolean" || rule_trimmed == "bool" {
                param_type = "boolean";
                validation_rules.push("boolean".to_string());
            } else if rule_trimmed == "array" {
                param_type = "array";
                validation_rules.push("array".to_string());
            } else if rule_trimmed == "json" {
                param_type = "object";
                validation_rules.push("json".to_string());
            } else if rule_trimmed.starts_with("email") {
                validation_rules.push("email".to_string());
            } else if rule_trimmed.starts_with("url") {
                validation_rules.push("url".to_string());
            } else if rule_trimmed.starts_with("date") {
                validation_rules.push("date".to_string());
            } else {
                // Other rules like max:255, min:1, unique:users, etc.
                validation_rules.push(rule_trimmed.to_string());
            }
        }

        let validation = if validation_rules.is_empty() {
            None
        } else {
            Some(validation_rules.clone())
        };

        let example = ExampleGenerator::generate_example(param_type, field_name, &validation);
        let default_value = ExampleGenerator::generate_default(param_type);

        EndpointParameter {
            name: field_name.to_string(),
            param_type: param_type.to_string(),
            source: "body".to_string(),
            required,
            validation,
            example,
            default_value,
        }
    }
}

