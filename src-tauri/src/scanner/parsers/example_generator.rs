use serde_json::Value;

pub struct ExampleGenerator;

impl ExampleGenerator {
    /// Generate example value based on parameter type, validation rules, and field name
    pub fn generate_example(
        param_type: &str,
        field_name: &str,
        validation_rules: &Option<Vec<String>>,
    ) -> Option<Value> {
        let rules = validation_rules.as_deref().unwrap_or(&[]);
        
        // Check for specific validation rules first
        if !rules.is_empty() {
            if Self::has_rule(rules, "email") {
                return Some(Value::String("user@example.com".to_string()));
            }
            
            if Self::has_rule(rules, "url") {
                return Some(Value::String("https://example.com".to_string()));
            }
            
            if Self::has_rule(rules, "date") {
                return Some(Value::String("2024-01-01".to_string()));
            }
        }
        
        // Generate based on field name patterns
        let field_lower = field_name.to_lowercase();
        if field_lower.contains("email") {
            return Some(Value::String("user@example.com".to_string()));
        }
        
        if field_lower.contains("name") && !field_lower.contains("username") {
            return Some(Value::String("John Doe".to_string()));
        }
        
        if field_lower.contains("phone") {
            return Some(Value::String("+1234567890".to_string()));
        }
        
        if field_lower.contains("url") || field_lower.contains("link") {
            return Some(Value::String("https://example.com".to_string()));
        }
        
        if field_lower.contains("date") || field_lower.contains("birth") {
            return Some(Value::String("2024-01-01".to_string()));
        }
        
        // Generate based on param type
        match param_type {
            "string" => {
                // Check for min/max constraints
                let min_len = if !rules.is_empty() {
                    Self::extract_min(rules)
                } else {
                    None
                };
                let max_len = if !rules.is_empty() {
                    Self::extract_max(rules)
                } else {
                    None
                };
                
                let example_len = if let (Some(min), Some(max)) = (min_len, max_len) {
                    std::cmp::min(std::cmp::max(min, 5), max)
                } else if let Some(min) = min_len {
                    std::cmp::max(min, 5)
                } else if let Some(max) = max_len {
                    std::cmp::min(max, 20)
                } else {
                    10
                };
                
                Some(Value::String("x".repeat(example_len)))
            }
            "number" | "integer" => {
                let min = if !rules.is_empty() {
                    Self::extract_min(rules).unwrap_or(1)
                } else {
                    1
                };
                Some(Value::Number(serde_json::Number::from(std::cmp::max(min, 1))))
            }
            "boolean" => Some(Value::Bool(false)),
            "array" => Some(Value::Array(vec![])),
            "object" => Some(Value::Object(serde_json::Map::new())),
            _ => Some(Value::String("example".to_string())),
        }
    }
    
    /// Generate default value (simpler than example)
    pub fn generate_default(param_type: &str) -> Option<Value> {
        match param_type {
            "string" => Some(Value::String(String::new())),
            "number" | "integer" => Some(Value::Number(serde_json::Number::from(0))),
            "boolean" => Some(Value::Bool(false)),
            "array" => Some(Value::Array(vec![])),
            "object" => Some(Value::Object(serde_json::Map::new())),
            _ => None,
        }
    }
    
    /// Check if validation rules contain a specific rule
    fn has_rule(rules: &[String], rule_name: &str) -> bool {
        rules.iter().any(|r| {
            r.trim() == rule_name || r.trim().starts_with(&format!("{}:", rule_name))
        })
    }
    
    /// Extract min value from validation rules (e.g., "min:5" -> 5)
    fn extract_min(rules: &[String]) -> Option<usize> {
        for rule in rules {
            if let Some(min_str) = rule.trim().strip_prefix("min:") {
                if let Ok(min) = min_str.parse::<usize>() {
                    return Some(min);
                }
            }
        }
        None
    }
    
    /// Extract max value from validation rules (e.g., "max:255" -> 255)
    fn extract_max(rules: &[String]) -> Option<usize> {
        for rule in rules {
            if let Some(max_str) = rule.trim().strip_prefix("max:") {
                if let Ok(max) = max_str.parse::<usize>() {
                    return Some(max);
                }
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_generate_email_example() {
        let rules = Some(vec!["required".to_string(), "email".to_string()]);
        let example = ExampleGenerator::generate_example("string", "email", &rules);
        assert_eq!(example, Some(Value::String("user@example.com".to_string())));
    }
    
    #[test]
    fn test_generate_name_example() {
        let example = ExampleGenerator::generate_example("string", "name", &None);
        assert_eq!(example, Some(Value::String("John Doe".to_string())));
    }
    
    #[test]
    fn test_generate_number_example() {
        let example = ExampleGenerator::generate_example("number", "age", &None);
        assert!(example.is_some());
        if let Some(Value::Number(n)) = example {
            assert!(n.as_u64().unwrap() >= 1);
        }
    }
    
    #[test]
    fn test_generate_boolean_example() {
        let example = ExampleGenerator::generate_example("boolean", "active", &None);
        assert_eq!(example, Some(Value::Bool(false)));
    }
}

