use crate::scanner::types::FrameworkInfo;
use std::path::{Path, PathBuf};

pub struct ServiceDetector {
    #[allow(dead_code)]
    project_root: PathBuf,
    framework_info: Option<FrameworkInfo>,
}

impl ServiceDetector {
    pub fn new(project_root: PathBuf, framework_info: Option<FrameworkInfo>) -> Self {
        Self {
            project_root,
            framework_info,
        }
    }

    pub fn detect_service_from_path(&self, file_path: &Path) -> String {
        // First, try to detect from directory structure
        if let Some(service) = self.detect_service_from_directory_structure(file_path) {
            return service;
        }

        // If no service found from path, try framework-specific detection
        if let Some(ref framework_info) = self.framework_info {
            if let Some(service) = self.detect_service_from_framework(file_path, framework_info) {
                return service;
            }
        }

        // Fallback to default
        self.get_default_service()
    }

    fn detect_service_from_directory_structure(&self, file_path: &Path) -> Option<String> {
        let path_str = file_path.to_string_lossy();

        // Check for common service patterns in path
        let service_patterns = vec![
            // Digital Card JAL patterns
            (r"/module/(dcmain|dccard)/", 1),
            // Generic patterns
            (r"/services/([^/]+)/", 1),
            (r"/api/([^/]+)/", 1),
            (r"/modules/([^/]+)/", 1),
            (r"/apps/([^/]+)/", 1),
            (r"/microservices/([^/]+)/", 1),
            // Framework-specific patterns
            (r"/src/([^/]+)/controllers/", 1),
            (r"/app/([^/]+)/controllers/", 1),
            (r"/lib/([^/]+)/", 1),
        ];

        for (pattern, group) in service_patterns {
            if let Ok(re) = regex::Regex::new(pattern) {
                if let Some(caps) = re.captures(&path_str) {
                    if let Some(m) = caps.get(group) {
                        return Some(m.as_str().to_string());
                    }
                }
            }
        }

        None
    }

    fn detect_service_from_framework(
        &self,
        file_path: &Path,
        framework_info: &FrameworkInfo,
    ) -> Option<String> {
        match framework_info.framework_type.as_str() {
            "go" => self.detect_go_service(file_path),
            "node" => self.detect_node_service(file_path),
            "php" => self.detect_php_service(file_path),
            "ruby" => self.detect_ruby_service(file_path),
            _ => None,
        }
    }

    fn detect_go_service(&self, file_path: &Path) -> Option<String> {
        let path_str = file_path.to_string_lossy();

        // Check if this is a multi-module project
        if path_str.contains("/module/") {
            if let Ok(re) = regex::Regex::new(r"/module/([^/]+)/") {
                if let Some(caps) = re.captures(&path_str) {
                    if let Some(m) = caps.get(1) {
                        return Some(m.as_str().to_string());
                    }
                }
            }
        }

        // Check for service directories
        let service_dirs = vec!["services", "apps", "microservices"];
        for dir in service_dirs {
            let pattern = format!(r"/{dir}/([^/]+)/");
            if let Ok(re) = regex::Regex::new(&pattern) {
                if let Some(caps) = re.captures(&path_str) {
                    if let Some(m) = caps.get(1) {
                        return Some(m.as_str().to_string());
                    }
                }
            }
        }

        None
    }

    fn detect_node_service(&self, file_path: &Path) -> Option<String> {
        let path_str = file_path.to_string_lossy();

        // Check for NestJS module structure
        if let Ok(re) = regex::Regex::new(r"/src/([^/]+)/") {
            if let Some(caps) = re.captures(&path_str) {
                if let Some(m) = caps.get(1) {
                    return Some(m.as_str().to_string());
                }
            }
        }

        // Check for Express routes/controllers
        if let Ok(re) = regex::Regex::new(r"/(?:routes|api)/([^/]+)/") {
            if let Some(caps) = re.captures(&path_str) {
                if let Some(m) = caps.get(1) {
                    return Some(m.as_str().to_string());
                }
            }
        }

        None
    }

    fn detect_php_service(&self, file_path: &Path) -> Option<String> {
        let path_str = file_path.to_string_lossy();

        // Check for Laravel namespace patterns
        if let Ok(re) = regex::Regex::new(r"/app/Http/Controllers/([^/]+)/") {
            if let Some(caps) = re.captures(&path_str) {
                if let Some(m) = caps.get(1) {
                    return Some(m.as_str().to_string());
                }
            }
        }

        // Check for routes
        if let Ok(re) = regex::Regex::new(r"/routes/([^/]+)\.php$") {
            if let Some(caps) = re.captures(&path_str) {
                if let Some(m) = caps.get(1) {
                    return Some(m.as_str().to_string());
                }
            }
        }

        None
    }

    fn detect_ruby_service(&self, file_path: &Path) -> Option<String> {
        let path_str = file_path.to_string_lossy();

        // Check for Rails namespace patterns
        if let Ok(re) = regex::Regex::new(r"/app/controllers/([^/]+)/") {
            if let Some(caps) = re.captures(&path_str) {
                if let Some(m) = caps.get(1) {
                    return Some(m.as_str().to_string());
                }
            }
        }

        None
    }

    fn get_default_service(&self) -> String {
        // For backward compatibility, return 'dcmain' as default
        "dcmain".to_string()
    }
}

