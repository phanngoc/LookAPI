use crate::scanner::types::{FrameworkInfo, FrameworkPatterns, FrameworkStructure};
use std::path::{Path, PathBuf};
use std::fs;
use serde_json::Value;

pub struct FrameworkDetector {
    project_path: PathBuf,
}

impl FrameworkDetector {
    pub fn new(project_path: PathBuf) -> Self {
        Self { project_path }
    }

    pub async fn detect_framework_info(&self) -> Result<FrameworkInfo, String> {
        // Try Node.js detection (package.json)
        let package_json_path = self.project_path.join("package.json");
        if package_json_path.exists() {
            if let Ok(framework_info) = self.detect_from_package_json(&package_json_path).await {
                return Ok(framework_info);
            }
        }

        // Try PHP detection (composer.json)
        let composer_json_path = self.project_path.join("composer.json");
        if composer_json_path.exists() {
            if let Ok(framework_info) = self.detect_from_composer_json(&composer_json_path).await {
                return Ok(framework_info);
            }
        }

        // Try Ruby detection (Gemfile)
        let gemfile_path = self.project_path.join("Gemfile");
        if gemfile_path.exists() {
            if let Ok(framework_info) = self.detect_from_gemfile(&gemfile_path).await {
                return Ok(framework_info);
            }
        }

        // Try Go detection (go.mod)
        let go_mod_path = self.project_path.join("go.mod");
        if go_mod_path.exists() {
            return Ok(self.get_go_framework_info());
        }

        // Default to unknown
        Ok(self.get_default_framework_info())
    }

    async fn detect_from_package_json(&self, path: &Path) -> Result<FrameworkInfo, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read package.json: {}", e))?;
        
        let package_json: Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse package.json: {}", e))?;

        let deps = package_json
            .get("dependencies")
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();
        let dev_deps = package_json
            .get("devDependencies")
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();

        // Check for NestJS
        if deps.get("@nestjs/core").is_some() || dev_deps.get("@nestjs/core").is_some() {
            let version = deps
                .get("@nestjs/core")
                .or_else(|| dev_deps.get("@nestjs/core"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            return Ok(FrameworkInfo {
                framework_type: "node".to_string(),
                framework: "nestjs".to_string(),
                version,
                patterns: FrameworkPatterns {
                    routing: vec![
                        "@Controller".to_string(),
                        "@Get".to_string(),
                        "@Post".to_string(),
                        "@Put".to_string(),
                        "@Delete".to_string(),
                        "@Patch".to_string(),
                    ],
                    controllers: vec!["**/*.controller.ts".to_string()],
                    decorators: vec![
                        "@Injectable".to_string(),
                        "@UseGuards".to_string(),
                        "@UseInterceptors".to_string(),
                    ],
                    middleware: vec![
                        "@UseInterceptors".to_string(),
                        "@UseFilters".to_string(),
                    ],
                },
                structure: FrameworkStructure {
                    controllers_path: vec!["src".to_string(), "apps".to_string()],
                    routes_path: vec!["src/app.module.ts".to_string()],
                    models_path: vec!["src/entities".to_string(), "src/models".to_string()],
                },
            });
        }

        // Check for Express
        if deps.get("express").is_some() || dev_deps.get("express").is_some() {
            let version = deps
                .get("express")
                .or_else(|| dev_deps.get("express"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            return Ok(FrameworkInfo {
                framework_type: "node".to_string(),
                framework: "express".to_string(),
                version,
                patterns: FrameworkPatterns {
                    routing: vec![
                        "app.get".to_string(),
                        "app.post".to_string(),
                        "router.get".to_string(),
                        "router.post".to_string(),
                    ],
                    controllers: vec!["**/*.js".to_string(), "**/*.ts".to_string()],
                    decorators: vec![],
                    middleware: vec!["app.use".to_string()],
                },
                structure: FrameworkStructure {
                    controllers_path: vec!["src".to_string(), "routes".to_string(), "controllers".to_string()],
                    routes_path: vec!["src".to_string(), "routes".to_string()],
                    models_path: vec!["src/models".to_string(), "models".to_string()],
                },
            });
        }

        Err("No supported framework found".to_string())
    }

    async fn detect_from_composer_json(&self, path: &Path) -> Result<FrameworkInfo, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read composer.json: {}", e))?;
        
        let composer_json: Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse composer.json: {}", e))?;

        let require = composer_json
            .get("require")
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();
        let require_dev = composer_json
            .get("require-dev")
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();

        // Check for Laravel
        if require.get("laravel/framework").is_some()
            || require.get("laravel/laravel").is_some()
            || require_dev.get("laravel/framework").is_some()
            || require_dev.get("laravel/laravel").is_some()
        {
            let version = require
                .get("laravel/framework")
                .or_else(|| require.get("laravel/laravel"))
                .or_else(|| require_dev.get("laravel/framework"))
                .or_else(|| require_dev.get("laravel/laravel"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            return Ok(FrameworkInfo {
                framework_type: "php".to_string(),
                framework: "laravel".to_string(),
                version,
                patterns: FrameworkPatterns {
                    routing: vec![
                        "Route::get".to_string(),
                        "Route::post".to_string(),
                        "Route::put".to_string(),
                        "Route::delete".to_string(),
                    ],
                    controllers: vec!["**/app/Http/Controllers/*.php".to_string()],
                    decorators: vec![],
                    middleware: vec!["middleware".to_string()],
                },
                structure: FrameworkStructure {
                    controllers_path: vec!["app/Http/Controllers".to_string()],
                    routes_path: vec!["routes".to_string()],
                    models_path: vec!["app/Models".to_string()],
                },
            });
        }

        Err("No supported framework found".to_string())
    }

    async fn detect_from_gemfile(&self, path: &Path) -> Result<FrameworkInfo, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read Gemfile: {}", e))?;

        // Check for Rails
        if content.contains("gem 'rails'") || content.contains("gem \"rails\"") {
            // Try to extract version - handle both single and double quotes
            // Use raw string with character class for quotes: [\"'] matches either quote
            let version = regex::Regex::new(r#"gem\s+["']rails["'](?:,\s*["']([^"']+)["'])?"#)
                .ok()
                .and_then(|re| re.captures(&content))
                .and_then(|caps| caps.get(1))
                .map(|m| m.as_str().to_string());

            return Ok(FrameworkInfo {
                framework_type: "ruby".to_string(),
                framework: "rails".to_string(),
                version,
                patterns: FrameworkPatterns {
                    routing: vec![
                        "get".to_string(),
                        "post".to_string(),
                        "put".to_string(),
                        "delete".to_string(),
                        "patch".to_string(),
                    ],
                    controllers: vec!["**/app/controllers/*.rb".to_string()],
                    decorators: vec![],
                    middleware: vec![
                        "before_action".to_string(),
                        "after_action".to_string(),
                    ],
                },
                structure: FrameworkStructure {
                    controllers_path: vec!["app/controllers".to_string()],
                    routes_path: vec!["config/routes.rb".to_string()],
                    models_path: vec!["app/models".to_string()],
                },
            });
        }

        Err("No supported framework found".to_string())
    }

    fn get_go_framework_info(&self) -> FrameworkInfo {
        FrameworkInfo {
            framework_type: "go".to_string(),
            framework: "custom".to_string(),
            version: None,
            patterns: FrameworkPatterns {
                routing: vec![],
                controllers: vec!["*_controller.go".to_string()],
                decorators: vec![],
                middleware: vec![],
            },
            structure: FrameworkStructure::default(),
        }
    }

    fn get_default_framework_info(&self) -> FrameworkInfo {
        FrameworkInfo {
            framework_type: "unknown".to_string(),
            framework: "unknown".to_string(),
            version: None,
            patterns: FrameworkPatterns::default(),
            structure: FrameworkStructure::default(),
        }
    }
}

