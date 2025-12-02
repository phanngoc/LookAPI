pub mod framework_detector;
pub mod parsers;
pub mod service_detector;
pub mod static_scanner;
pub mod types;

pub use framework_detector::FrameworkDetector;
pub use service_detector::ServiceDetector;
pub use static_scanner::StaticScanner;
pub use types::*;

use std::path::PathBuf;

/// Unified scanner entry point
pub struct UnifiedScanner {
    project_path: PathBuf,
}

impl UnifiedScanner {
    pub fn new(project_path: PathBuf) -> Self {
        Self { project_path }
    }

    pub async fn scan(&self) -> Result<types::ScanResult, String> {
        // Step 1: Detect framework
        let detector = FrameworkDetector::new(self.project_path.clone());
        let framework_info = detector.detect_framework_info().await?;

        // Step 2: Perform static scan
        let scanner = StaticScanner::new(self.project_path.clone(), framework_info.clone());
        let endpoints = scanner.scan_endpoints().await?;

        // Step 3: Return unified result
        Ok(types::ScanResult {
            framework_info,
            endpoints,
            scan_method: "static".to_string(),
        })
    }
}

