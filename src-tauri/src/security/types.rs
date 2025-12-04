use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ScanType {
    SqlInjection,
    XssInjection,
    XPathInjection,
    MalformedXml,
    XmlBomb,
    FuzzingScan,
    BoundaryScan,
    InvalidTypes,
}

impl ScanType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ScanType::SqlInjection => "SQL Injection",
            ScanType::XssInjection => "Cross Site Scripting",
            ScanType::XPathInjection => "XPath Injection",
            ScanType::MalformedXml => "Malformed XML",
            ScanType::XmlBomb => "XML Bomb",
            ScanType::FuzzingScan => "Fuzzing Scan",
            ScanType::BoundaryScan => "Boundary Scan",
            ScanType::InvalidTypes => "Invalid Types",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityTestCase {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub endpoint_id: Option<String>,
    pub scans: Vec<ScanConfig>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanConfig {
    pub scan_type: ScanType,
    pub enabled: bool,
    pub assertions: Vec<Assertion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Assertion {
    pub assertion_type: AssertionType,
    pub expected: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AssertionType {
    StatusCodeNot,      // Response status should NOT be this
    BodyNotContains,    // Response body should NOT contain
    ResponseTime,       // Response time should be less than (ms)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityScanResult {
    pub id: String,
    pub test_case_id: String,
    pub scan_type: ScanType,
    pub status: ScanStatus,
    pub requests_sent: u32,
    pub alerts: Vec<SecurityAlert>,
    pub duration_ms: u64,
    pub started_at: i64,
    pub completed_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ScanStatus {
    Pending,
    Running,
    Pass,
    Fail,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityAlert {
    pub severity: AlertSeverity,
    pub message: String,
    pub payload: String,
    pub response_snippet: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AlertSeverity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityTestRun {
    pub id: String,
    pub test_case_id: String,
    pub status: ScanStatus,
    pub total_scans: u32,
    pub completed_scans: u32,
    pub total_requests: u32,
    pub total_alerts: u32,
    pub results: Vec<SecurityScanResult>,
    pub started_at: i64,
    pub completed_at: Option<i64>,
}
