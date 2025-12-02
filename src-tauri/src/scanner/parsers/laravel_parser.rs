use crate::scanner::types::{
    Authentication, Authorization, BusinessLogic, EndpointParameter, ScannedEndpoint,
};
use glob::glob;
use regex::Regex;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

pub struct LaravelParser {
    project_path: PathBuf,
    endpoint_metadata: HashMap<String, EndpointMetadata>,
    controller_files_cache: HashMap<String, String>,
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
        }
    }

    pub async fn parse_endpoints(&mut self) -> Result<Vec<ScannedEndpoint>, String> {
        let mut endpoints = Vec::new();

        // Step 1: Parse routes files
        let routes_endpoints = self.parse_routes_files().await?;
        endpoints.extend(routes_endpoints);

        // Step 2: Build controller files cache
        self.build_controller_files_cache().await?;

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
                if let Some(method_params) =
                    self.extract_method_parameters(&controller_content, &metadata.method_name)
                {
                    endpoint.parameters.extend(method_params);
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

                    params.push(EndpointParameter {
                        name: name.to_string(),
                        param_type: param_type.to_string(),
                        source: "path".to_string(),
                        required: !is_optional,
                        validation: constraint.map(|c| vec![c]),
                    });
                }
            }
        }

        params
    }

    fn extract_method_parameters(
        &self,
        controller_content: &str,
        method_name: &str,
    ) -> Option<Vec<EndpointParameter>> {
        // Find method signature: public function methodName(...)
        let method_pattern = format!(r"public\s+function\s+{}\s*\(([^)]*)\)", method_name);
        let method_re = Regex::new(&method_pattern).ok()?;

        let method_params_str = method_re
            .captures(controller_content)?
            .get(1)?
            .as_str();

        // Extract parameters from method signature
        // Pattern: Request $request, int $id, etc.
        let param_re = Regex::new(r"(\w+)\s+\$(\w+)").ok()?;
        let mut params = Vec::new();

        for cap in param_re.captures_iter(method_params_str) {
            if let (Some(type_match), Some(name_match)) = (cap.get(1), cap.get(2)) {
                let param_type_str = type_match.as_str();
                let param_name = name_match.as_str();

                let (api_type, source) = if param_type_str.contains("Request") {
                    ("object", "body")
                } else if param_type_str.contains("int") || param_type_str.contains("float") {
                    ("number", "body")
                } else if param_type_str.contains("bool") {
                    ("boolean", "body")
                } else {
                    ("string", "body")
                };

                params.push(EndpointParameter {
                    name: param_name.to_string(),
                    param_type: api_type.to_string(),
                    source: source.to_string(),
                    required: true,
                    validation: None,
                });
            }
        }

        Some(params)
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

        Ok(ScannedEndpoint {
            path: route_path.to_string(),
            method: method.to_string(),
            controller: controller_name.clone(),
            action: action.to_string(),
            file_path: file_path.to_string_lossy().to_string(),
            line_number: 0,
            parameters: Vec::new(),
            business_logic: BusinessLogic {
                summary: format!("{} {}", method, route_path),
                description: format!("{}@{}", controller_name, action),
                purpose: String::new(),
                dependencies: Vec::new(),
            },
            authentication: Authentication::default(),
            authorization: Authorization::default(),
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
}

