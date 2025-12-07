use crate::scanner::types::{FrameworkInfo, ScannedEndpoint};
use crate::scanner::parsers::laravel_parser::LaravelParser;
use crate::scanner::parsers::nestjs_parser::NestJSParser;
use std::path::PathBuf;

pub struct StaticScanner {
    project_path: PathBuf,
    framework_info: FrameworkInfo,
}

impl StaticScanner {
    pub fn new(project_path: PathBuf, framework_info: FrameworkInfo) -> Self {
        Self {
            project_path,
            framework_info,
        }
    }

    pub async fn scan_endpoints(&self) -> Result<Vec<ScannedEndpoint>, String> {
        match self.framework_info.framework.as_str() {
            "laravel" => self.scan_laravel_endpoints().await,
            "nestjs" => self.scan_nestjs_endpoints().await,
            "rails" => {
                // Placeholder for Rails
                Ok(vec![])
            }
            "express" => {
                // Placeholder for Express
                Ok(vec![])
            }
            _ => {
                // Unknown or unsupported framework
                Ok(vec![])
            }
        }
    }

    async fn scan_laravel_endpoints(&self) -> Result<Vec<ScannedEndpoint>, String> {
        let mut parser = LaravelParser::new(self.project_path.clone());
        parser.parse_endpoints().await
    }

    async fn scan_nestjs_endpoints(&self) -> Result<Vec<ScannedEndpoint>, String> {
        let mut parser = NestJSParser::new(self.project_path.clone());
        parser.parse_endpoints().await
    }
}

