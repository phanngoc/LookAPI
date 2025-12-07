use crate::scanner::parsers::example_generator::ExampleGenerator;
use crate::scanner::types::{
    Authentication, Authorization, BusinessLogic, EndpointParameter, ScannedEndpoint,
};
use glob::glob;
use regex::Regex;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

struct MethodInfo {
    method_name: String,
    params: String,
    method_auth: Authentication,
}

pub struct NestJSParser {
    project_path: PathBuf,
    controller_files_cache: HashMap<String, String>,
    dto_files_cache: HashMap<String, String>,
}

impl NestJSParser {
    pub fn new(project_path: PathBuf) -> Self {
        Self {
            project_path,
            controller_files_cache: HashMap::new(),
            dto_files_cache: HashMap::new(),
        }
    }

    pub async fn parse_endpoints(&mut self) -> Result<Vec<ScannedEndpoint>, String> {
        // Step 1: Build caches
        self.build_controller_files_cache().await?;
        self.build_dto_files_cache().await?;

        // Step 2: Parse all controller files
        let mut endpoints = Vec::new();
        for (_, file_path) in &self.controller_files_cache {
            if let Ok(content) = fs::read_to_string(file_path) {
                let file_endpoints = self.parse_controller_content(&content, Path::new(file_path))?;
                endpoints.extend(file_endpoints);
            }
        }

        // Step 3: Remove duplicates
        let unique_endpoints = self.deduplicate_endpoints(endpoints);

        Ok(unique_endpoints)
    }

    async fn build_controller_files_cache(&mut self) -> Result<(), String> {
        let pattern_str = format!("{}/**/*.controller.ts", self.project_path.to_string_lossy());

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

    async fn build_dto_files_cache(&mut self) -> Result<(), String> {
        let pattern_str = format!("{}/**/dto/*.dto.ts", self.project_path.to_string_lossy());

        if let Ok(entries) = glob(&pattern_str) {
            for entry in entries.flatten() {
                if let Ok(content) = fs::read_to_string(&entry) {
                    if let Some(dto_class) = self.extract_dto_class(&content) {
                        let file_path = entry.to_string_lossy().to_string();
                        
                        // Store with full class name
                        self.dto_files_cache
                            .insert(dto_class.clone(), file_path.clone());
                        
                        // Also store with simple class name for lookup
                        if let Some(simple_name) = dto_class.split('.').last() {
                            self.dto_files_cache
                                .insert(simple_name.to_string(), file_path);
                        }
                    }
                }
            }
        }

        Ok(())
    }

    fn extract_controller_class(&self, content: &str, _file_path: &Path) -> Option<String> {
        // Try to extract class name: export class CartController
        let class_re = Regex::new(r"export\s+class\s+(\w+Controller)\s*(?:extends|implements|\{)").ok()?;
        
        if let Some(cap) = class_re.captures(content) {
            if let Some(class_match) = cap.get(1) {
                return Some(class_match.as_str().to_string());
            }
        }

        None
    }

    fn extract_dto_class(&self, content: &str) -> Option<String> {
        // Try to extract DTO class name: export class AddToCartDto
        let class_re = Regex::new(r"export\s+class\s+(\w+Dto)\s*(?:extends|implements|\{)").ok()?;
        
        if let Some(cap) = class_re.captures(content) {
            if let Some(class_match) = cap.get(1) {
                return Some(class_match.as_str().to_string());
            }
        }

        None
    }

    fn parse_controller_content(
        &self,
        content: &str,
        file_path: &Path,
    ) -> Result<Vec<ScannedEndpoint>, String> {
        let mut endpoints = Vec::new();

        // Extract controller base path from @Controller('path')
        let base_path = self.extract_controller_base_path(content);

        // Extract authentication from controller level @UseGuards
        let controller_auth = self.detect_authentication(content, true);

        // Find all method decorators: @Get(), @Post(), etc.
        // Use a more comprehensive pattern that handles multiline decorators
        // Match both single and double quotes using alternation
        let method_patterns = vec![
            (r#"@Get\s*(?:\(\s*(?:'([^']*)'|"([^"]*)")\s*\))?"#, "GET"),
            (r#"@Post\s*(?:\(\s*(?:'([^']*)'|"([^"]*)")\s*\))?"#, "POST"),
            (r#"@Put\s*(?:\(\s*(?:'([^']*)'|"([^"]*)")\s*\))?"#, "PUT"),
            (r#"@Patch\s*(?:\(\s*(?:'([^']*)'|"([^"]*)")\s*\))?"#, "PATCH"),
            (r#"@Delete\s*(?:\(\s*(?:'([^']*)'|"([^"]*)")\s*\))?"#, "DELETE"),
        ];

        for (pattern, method) in method_patterns {
            if let Ok(re) = Regex::new(pattern) {
                for cap in re.captures_iter(content) {
                    // Get path from either single or double quote capture group
                    let method_path = cap.get(1)
                        .or_else(|| cap.get(2))
                        .map(|m| m.as_str())
                        .unwrap_or("");
                    let decorator_start = cap.get(0).unwrap().start();
                    
                    // Find the method definition after this decorator
                    // Look for method in the next 20 lines after decorator
                    if let Some(method_info) = self.find_method_after_decorator(content, decorator_start, method) {
                        let full_path = self.build_full_path(&base_path, method_path);
                        
                        let endpoint = self.create_endpoint(
                            &full_path,
                            method,
                            &method_info.method_name,
                            &method_info.params,
                            file_path,
                            &controller_auth,
                            &method_info.method_auth,
                        )?;

                        endpoints.push(endpoint);
                    }
                }
            }
        }

        Ok(endpoints)
    }

    fn extract_controller_base_path(&self, content: &str) -> String {
        // Match both single and double quotes
        let controller_re = Regex::new(r#"@Controller\s*\(\s*(?:'([^']+)'|"([^"]+)")\s*\)"#).ok();
        
        if let Some(re) = controller_re {
            if let Some(cap) = re.captures(content) {
                // Get path from either single or double quote capture group
                if let Some(path_match) = cap.get(1).or_else(|| cap.get(2)) {
                    let path = path_match.as_str();
                    return if path.starts_with('/') {
                        path.to_string()
                    } else {
                        format!("/{}", path)
                    };
                }
            }
        }

        String::new()
    }

    fn find_method_after_decorator(
        &self,
        content: &str,
        decorator_start: usize,
        _http_method: &str,
    ) -> Option<MethodInfo> {
        // Look ahead from decorator position, but limit search to avoid matching wrong methods
        // Find the next method definition within reasonable distance (e.g., next 500 chars)
        let search_end = (decorator_start + 500).min(content.len());
        let remaining = &content[decorator_start..search_end];

        // Find the next method definition: async methodName(...) or methodName(...)
        // Skip comments and other decorators
        let method_re = Regex::new(r"(?:async\s+)?(\w+)\s*\(([^)]*)\)").ok()?;
        
        // Try to find method, but skip if it looks like it's part of a decorator or comment
        for method_cap in method_re.captures_iter(remaining) {
            let method_pos = method_cap.get(0).unwrap().start();
            let before_method = &remaining[..method_pos];
            
            // Check if there's a comment or decorator between decorator and method
            // If the last non-whitespace before method is @, it's probably another decorator
            let last_non_ws = before_method.trim_end().chars().last();
            if last_non_ws == Some('@') {
                continue; // Skip, this is probably a decorator parameter
            }
            
            if let (Some(name_match), Some(params_match)) = (method_cap.get(1), method_cap.get(2)) {
                let method_name = name_match.as_str().to_string();
                let params = params_match.as_str().to_string();

                // Extract method-level authentication
                // Look for @UseGuards between decorator and method
                let method_start = decorator_start + method_pos;
                let method_auth = self.extract_method_auth(content, method_start);

                return Some(MethodInfo {
                    method_name,
                    params,
                    method_auth,
                });
            }
        }

        None
    }

    fn extract_method_auth(&self, content: &str, method_start: usize) -> Authentication {
        // Look backwards from method start to find @UseGuards decorators
        let before_method = &content[..method_start];
        let method_auth = self.detect_authentication(before_method, false);
        method_auth
    }

    fn build_full_path(&self, base_path: &str, method_path: &str) -> String {
        let base = if base_path.is_empty() {
            String::new()
        } else {
            base_path.to_string()
        };

        let method = if method_path.is_empty() {
            String::new()
        } else if method_path.starts_with('/') {
            method_path.to_string()
        } else {
            format!("/{}", method_path)
        };

        if base.is_empty() {
            if method.is_empty() {
                "/".to_string()
            } else {
                method
            }
        } else if method.is_empty() {
            base
        } else {
            format!("{}{}", base, method)
        }
    }

    fn create_endpoint(
        &self,
        path: &str,
        method: &str,
        action: &str,
        params_str: &str,
        file_path: &Path,
        controller_auth: &Authentication,
        method_auth: &Authentication,
    ) -> Result<ScannedEndpoint, String> {
        // Use method-level auth if present, otherwise use controller-level
        let auth = if method_auth.required {
            method_auth.clone()
        } else {
            controller_auth.clone()
        };

        // Extract parameters from method signature
        let parameters = self.extract_method_parameters(params_str, method)?;

        // Extract path parameters from path string
        let path_params = self.parse_path_parameters(path);
        
        // Combine all parameters
        let mut all_params = path_params;
        all_params.extend(parameters);

        Ok(ScannedEndpoint {
            path: path.to_string(),
            method: method.to_string(),
            controller: String::new(), // Will be filled later if needed
            action: action.to_string(),
            file_path: file_path.to_string_lossy().to_string(),
            line_number: 0,
            parameters: all_params,
            business_logic: BusinessLogic {
                summary: format!("{} {}", method, path),
                description: format!("{}@{}", "Controller", action),
                purpose: String::new(),
                dependencies: Vec::new(),
            },
            authentication: auth,
            authorization: Authorization::default(),
        })
    }

    fn extract_method_parameters(
        &self,
        params_str: &str,
        _http_method: &str,
    ) -> Result<Vec<EndpointParameter>, String> {
        let mut params = Vec::new();

        // Parse parameters: @Body() dto: DtoType, @Param('id') id: number, etc.
        
        // Pattern 1: @Body() dto: DtoType
        let body_pattern = r"@Body\s*(?:\(\))?\s+(\w+):\s*(\w+)";
        if let Ok(body_re) = Regex::new(body_pattern) {
            for cap in body_re.captures_iter(params_str) {
                if let (Some(_dto_name), Some(dto_type)) = (cap.get(1), cap.get(2)) {
                    let dto_type_str = dto_type.as_str();
                    // Parse DTO file to get body parameters
                    // Note: This is a blocking call, but DTO parsing is fast
                    if let Ok(dto_params) = self.parse_dto_file(dto_type_str) {
                        params.extend(dto_params);
                    }
                }
            }
        }

        // Pattern 2: @Param('id') id: number or @Param('id', ParseIntPipe) id: number
        let param_pattern = r#"@Param\s*\(\s*(?:'([^']+)'|"([^"]+)")\s*(?:,\s*[^)]+)?\)\s+(\w+):\s*(\w+)"#;
        if let Ok(param_re) = Regex::new(param_pattern) {
            for cap in param_re.captures_iter(params_str) {
                // Get param name from either single or double quote capture group
                if let (Some(param_name_match), Some(_var_name), Some(param_type)) = 
                    (cap.get(1).or_else(|| cap.get(2)), cap.get(3), cap.get(4)) {
                    let param_name = param_name_match.as_str();
                    let param_type_str = param_type.as_str();

                    let api_type = self.map_typescript_type(param_type_str);
                    let example = ExampleGenerator::generate_example(&api_type, param_name, &None);
                    let default_value = ExampleGenerator::generate_default(&api_type);

                    params.push(EndpointParameter {
                        name: param_name.to_string(),
                        param_type: api_type,
                        source: "path".to_string(),
                        required: true,
                        validation: None,
                        example,
                        default_value,
                    });
                }
            }
        }

        // Pattern 3: @Query() query: QueryDto or @Query('paramName') param: type
        let query_pattern = r#"@Query\s*(?:\(\s*(?:'([^']+)'|"([^"]+)")\s*\))?\s+(?:(\w+):\s*)?(\w+)"#;
        if let Ok(query_re) = Regex::new(query_pattern) {
            for cap in query_re.captures_iter(params_str) {
                // Get param name from either single or double quote capture group
                let param_name_opt = cap.get(1).or_else(|| cap.get(2));
                if let Some(type_match) = cap.get(4) {
                    
                    // If param_name is provided, it's a single query param
                    if let Some(param_name_match) = param_name_opt {
                        let param_name = param_name_match.as_str();
                        let param_type_str = type_match.as_str();

                        let api_type = self.map_typescript_type(param_type_str);
                        let example = ExampleGenerator::generate_example(&api_type, param_name, &None);
                        let default_value = ExampleGenerator::generate_default(&api_type);

                        params.push(EndpointParameter {
                            name: param_name.to_string(),
                            param_type: api_type,
                            source: "query".to_string(),
                            required: false, // Query params are usually optional
                            validation: None,
                            example,
                            default_value,
                        });
                    } else {
                        // It's a DTO for query params
                        let dto_type_str = type_match.as_str();
                        if let Ok(dto_params) = self.parse_dto_file(dto_type_str) {
                            // Change source to query for all params
                            let query_params: Vec<EndpointParameter> = dto_params
                                .into_iter()
                                .map(|mut p| {
                                    p.source = "query".to_string();
                                    p.required = false; // Query params are usually optional
                                    p
                                })
                                .collect();
                            params.extend(query_params);
                        }
                    }
                }
            }
        }

        Ok(params)
    }

    fn parse_dto_file(&self, dto_class_name: &str) -> Result<Vec<EndpointParameter>, String> {
        // Find DTO file
        let dto_file_path = self.dto_files_cache.get(dto_class_name).cloned();

        if let Some(file_path) = dto_file_path {
            if let Ok(dto_content) = fs::read_to_string(&file_path) {
                return self.extract_dto_properties(&dto_content);
            }
        }

        Ok(Vec::new())
    }

    fn extract_dto_properties(&self, dto_content: &str) -> Result<Vec<EndpointParameter>, String> {
        let mut params = Vec::new();

        // Find all class properties with decorators
        // Better approach: find property declarations and their decorators
        let lines: Vec<&str> = dto_content.lines().collect();
        let mut i = 0;
        
        while i < lines.len() {
            let line = lines[i].trim();
            
            // Check if this line starts a property declaration (has : and is not a comment)
            if line.contains(':') && !line.starts_with("//") && !line.starts_with("*") && !line.starts_with("/**") {
                // Look backwards for decorators (can span multiple lines)
                let mut decorators = Vec::new();
                let mut j = i.saturating_sub(1);
                while j < lines.len() && (lines[j].trim().starts_with('@') || lines[j].trim().is_empty() || lines[j].trim().starts_with("//")) {
                    let trimmed = lines[j].trim();
                    if trimmed.starts_with('@') {
                        decorators.insert(0, trimmed);
                    }
                    if j == 0 {
                        break;
                    }
                    j = j.saturating_sub(1);
                }
                
                // Extract property name and type
                if let Some(property_info) = self.parse_property_line(line, &decorators) {
                    params.push(property_info);
                }
            }
            
            i += 1;
        }

        Ok(params)
    }

    fn parse_property_line(
        &self,
        line: &str,
        decorators: &[&str],
    ) -> Option<EndpointParameter> {
        // Extract property name and type: propertyName: type; or propertyName?: type;
        let prop_re = Regex::new(r"(\w+)\??\s*:\s*(\w+)(?:\s*[=;])?").ok()?;
        let cap = prop_re.captures(line)?;
        
        let property_name = cap.get(1)?.as_str();
        let property_type = cap.get(2)?.as_str();
        
        // Check if property is optional from TypeScript syntax
        let is_optional_ts = line.contains('?');

        // Parse decorators to extract validation rules
        let mut param_type = self.map_typescript_type(property_type);
        let mut required = !is_optional_ts;
        let mut validation_rules = Vec::new();
        let mut example_value: Option<Value> = None;

        for decorator in decorators {
            if decorator.contains("@IsOptional") {
                required = false;
            } else if decorator.contains("@IsNotEmpty") {
                required = true;
                validation_rules.push("required".to_string());
            } else if decorator.contains("@IsInt") || decorator.contains("@IsNumber") {
                param_type = "number".to_string();
                validation_rules.push("integer".to_string());
            } else if decorator.contains("@IsString") {
                param_type = "string".to_string();
                validation_rules.push("string".to_string());
            } else if decorator.contains("@IsBoolean") || decorator.contains("@IsBool") {
                param_type = "boolean".to_string();
                validation_rules.push("boolean".to_string());
            } else if decorator.contains("@IsArray") {
                param_type = "array".to_string();
                validation_rules.push("array".to_string());
            } else if decorator.contains("@IsEmail") {
                param_type = "string".to_string();
                validation_rules.push("email".to_string());
            } else if decorator.contains("@IsEnum") {
                param_type = "string".to_string();
                validation_rules.push("enum".to_string());
            } else if decorator.contains("@Min(") {
                // Extract min value: @Min(1)
                if let Ok(min_re) = Regex::new(r"@Min\s*\(\s*(\d+)\s*\)") {
                    if let Some(min_cap) = min_re.captures(decorator) {
                        if let Some(min_val) = min_cap.get(1) {
                            validation_rules.push(format!("min:{}", min_val.as_str()));
                        }
                    }
                }
            } else if decorator.contains("@Max(") {
                // Extract max value: @Max(100)
                if let Ok(max_re) = Regex::new(r"@Max\s*\(\s*(\d+)\s*\)") {
                    if let Some(max_cap) = max_re.captures(decorator) {
                        if let Some(max_val) = max_cap.get(1) {
                            validation_rules.push(format!("max:{}", max_val.as_str()));
                        }
                    }
                }
            } else if decorator.contains("@MinLength(") {
                // Extract min length: @MinLength(6)
                if let Ok(min_re) = Regex::new(r"@MinLength\s*\(\s*(\d+)\s*\)") {
                    if let Some(min_cap) = min_re.captures(decorator) {
                        if let Some(min_val) = min_cap.get(1) {
                            validation_rules.push(format!("minLength:{}", min_val.as_str()));
                        }
                    }
                }
            } else if decorator.contains("@MaxLength(") {
                // Extract max length: @MaxLength(255)
                if let Ok(max_re) = Regex::new(r"@MaxLength\s*\(\s*(\d+)\s*\)") {
                    if let Some(max_cap) = max_re.captures(decorator) {
                        if let Some(max_val) = max_cap.get(1) {
                            validation_rules.push(format!("maxLength:{}", max_val.as_str()));
                        }
                    }
                }
            } else if decorator.contains("@ApiProperty") || decorator.contains("@ApiPropertyOptional") {
                // Extract example value: @ApiProperty({ example: 1 })
                if let Ok(example_re) = Regex::new(r"example\s*:\s*([^,}]+)") {
                    if let Some(example_cap) = example_re.captures(decorator) {
                        if let Some(example_match) = example_cap.get(1) {
                            let example_str = example_match.as_str().trim();
                            // Try to parse as JSON value
                            example_value = self.parse_example_value(example_str);
                        }
                    }
                }
                
                // Check if it's ApiPropertyOptional
                if decorator.contains("@ApiPropertyOptional") {
                    required = false;
                }
            }
        }

        let validation = if validation_rules.is_empty() {
            None
        } else {
            Some(validation_rules)
        };

        // Use extracted example if available, otherwise generate one
        let example = example_value.or_else(|| {
            ExampleGenerator::generate_example(&param_type, property_name, &validation)
        });
        let default_value = ExampleGenerator::generate_default(&param_type);

        Some(EndpointParameter {
            name: property_name.to_string(),
            param_type,
            source: "body".to_string(),
            required,
            validation,
            example,
            default_value,
        })
    }

    fn parse_example_value(&self, value_str: &str) -> Option<Value> {
        // Remove quotes if present
        let cleaned = value_str.trim().trim_matches('\'').trim_matches('"');
        
        // Try to parse as number
        if let Ok(num) = cleaned.parse::<i64>() {
            return Some(Value::Number(serde_json::Number::from(num)));
        }
        
        // Try to parse as float
        if let Ok(num) = cleaned.parse::<f64>() {
            if let Some(n) = serde_json::Number::from_f64(num) {
                return Some(Value::Number(n));
            }
        }
        
        // Try to parse as boolean
        if cleaned == "true" {
            return Some(Value::Bool(true));
        }
        if cleaned == "false" {
            return Some(Value::Bool(false));
        }
        
        // Default to string
        Some(Value::String(cleaned.to_string()))
    }

    fn map_typescript_type(&self, ts_type: &str) -> String {
        match ts_type {
            "number" | "Number" => "number".to_string(),
            "string" | "String" => "string".to_string(),
            "boolean" | "Boolean" => "boolean".to_string(),
            "Date" => "string".to_string(), // Dates are usually strings in APIs
            _ => "string".to_string(), // Default to string
        }
    }

    fn parse_path_parameters(&self, path: &str) -> Vec<EndpointParameter> {
        let mut params = Vec::new();
        // NestJS path parameter pattern: :id, :itemId
        let param_re = Regex::new(r":(\w+)").ok();

        if let Some(re) = param_re {
            for cap in re.captures_iter(path) {
                if let Some(name_match) = cap.get(1) {
                    let name = name_match.as_str();
                    let api_type = "string".to_string(); // Default, can be overridden by @Param
                    let example = ExampleGenerator::generate_example(&api_type, name, &None);
                    let default_value = ExampleGenerator::generate_default(&api_type);

                    params.push(EndpointParameter {
                        name: name.to_string(),
                        param_type: api_type,
                        source: "path".to_string(),
                        required: true,
                        validation: None,
                        example,
                        default_value,
                    });
                }
            }
        }

        params
    }

    fn detect_authentication(&self, content: &str, _is_controller_level: bool) -> Authentication {
        // Check for @UseGuards(JwtAuthGuard) or similar
        let guard_pattern = r"@UseGuards\s*\(\s*(\w+AuthGuard)\s*\)";
        if let Ok(guard_re) = Regex::new(guard_pattern) {
            if guard_re.is_match(content) {
                return Authentication {
                    required: true,
                    auth_type: Some("JWT".to_string()),
                };
            }
        }

        // Check for @ApiBearerAuth() which also indicates auth
        if content.contains("@ApiBearerAuth") {
            return Authentication {
                required: true,
                auth_type: Some("JWT".to_string()),
            };
        }

        Authentication::default()
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
