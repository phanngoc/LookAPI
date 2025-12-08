use crate::types::{ApiEndpoint, TestSuite, QueryResult, Project, YamlFile};
use crate::security::types::{SecurityTestCase, SecurityTestRun, ScanConfig};
use crate::scenario::types::{TestScenario, TestScenarioStep, TestScenarioRun, TestStepType, ScenarioRunStatus};
use crate::scenario::performance::{
    PerformanceTestConfig, PerformanceTestRun, PerformanceTestType, PerformanceRunStatus,
    Stage, Threshold,
};
use rusqlite::{Connection, Result};
use std::path::PathBuf;

pub fn get_db_path() -> PathBuf {
    let mut path = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("api-tester");
    std::fs::create_dir_all(&path).ok();
    path.push("api_tester.db");
    path
}

pub fn init_database() -> Result<()> {
    let conn = Connection::open(get_db_path())?;

    // Projects table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL,
            last_scanned INTEGER
        )",
        [],
    )?;

    // Endpoints table with project_id
    conn.execute(
        "CREATE TABLE IF NOT EXISTS endpoints (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            name TEXT NOT NULL,
            method TEXT NOT NULL,
            path TEXT NOT NULL,
            service TEXT NOT NULL,
            description TEXT,
            category TEXT,
            parameters TEXT NOT NULL DEFAULT '[]',
            explanation TEXT,
            created_at INTEGER,
            updated_at INTEGER,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Add project_id column if it doesn't exist (migration for existing databases)
    let _ = conn.execute("ALTER TABLE endpoints ADD COLUMN project_id TEXT", []);

    // Add base_url column to projects table if it doesn't exist (migration)
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN base_url TEXT", []);

    // Add responses column to endpoints table if it doesn't exist (migration)
    let _ = conn.execute("ALTER TABLE endpoints ADD COLUMN responses TEXT DEFAULT '[]'", []);

    conn.execute(
        "CREATE TABLE IF NOT EXISTS test_suites (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            endpoints TEXT NOT NULL DEFAULT '[]',
            category TEXT,
            created_at INTEGER,
            updated_at INTEGER
        )",
        [],
    )?;

    // Security test cases table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS security_test_cases (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            endpoint_id TEXT,
            scans TEXT NOT NULL DEFAULT '[]',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Security test runs table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS security_test_runs (
            id TEXT PRIMARY KEY,
            test_case_id TEXT NOT NULL,
            status TEXT NOT NULL,
            total_scans INTEGER NOT NULL,
            completed_scans INTEGER NOT NULL,
            total_requests INTEGER NOT NULL,
            total_alerts INTEGER NOT NULL,
            results TEXT NOT NULL DEFAULT '[]',
            started_at INTEGER NOT NULL,
            completed_at INTEGER,
            FOREIGN KEY (test_case_id) REFERENCES security_test_cases(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Test scenarios table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS test_scenarios (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            priority TEXT DEFAULT 'medium',
            variables TEXT DEFAULT '{}',
            pre_script TEXT,
            post_script TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Test scenario steps table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS test_scenario_steps (
            id TEXT PRIMARY KEY,
            scenario_id TEXT NOT NULL,
            step_order INTEGER NOT NULL,
            step_type TEXT NOT NULL,
            name TEXT NOT NULL,
            config TEXT NOT NULL DEFAULT '{}',
            enabled INTEGER DEFAULT 1,
            FOREIGN KEY (scenario_id) REFERENCES test_scenarios(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Test scenario runs table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS test_scenario_runs (
            id TEXT PRIMARY KEY,
            scenario_id TEXT NOT NULL,
            status TEXT NOT NULL,
            total_steps INTEGER NOT NULL,
            passed_steps INTEGER NOT NULL DEFAULT 0,
            failed_steps INTEGER NOT NULL DEFAULT 0,
            skipped_steps INTEGER NOT NULL DEFAULT 0,
            duration_ms INTEGER,
            started_at INTEGER NOT NULL,
            completed_at INTEGER,
            error_message TEXT,
            results TEXT NOT NULL DEFAULT '[]',
            variables TEXT DEFAULT '{}',
            FOREIGN KEY (scenario_id) REFERENCES test_scenarios(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // YAML files table - stores generated YAML content
    conn.execute(
        "CREATE TABLE IF NOT EXISTS yaml_files (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            scenario_id TEXT,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (scenario_id) REFERENCES test_scenarios(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Performance test configurations table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS performance_test_configs (
            id TEXT PRIMARY KEY,
            scenario_id TEXT NOT NULL,
            name TEXT NOT NULL,
            test_type TEXT NOT NULL,
            vus INTEGER,
            duration_secs INTEGER,
            iterations INTEGER,
            stages TEXT DEFAULT '[]',
            thresholds TEXT DEFAULT '[]',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (scenario_id) REFERENCES test_scenarios(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Performance test runs table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS performance_test_runs (
            id TEXT PRIMARY KEY,
            config_id TEXT NOT NULL,
            scenario_id TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at INTEGER NOT NULL,
            completed_at INTEGER,
            duration_ms INTEGER,
            max_vus_reached INTEGER,
            metrics TEXT,
            threshold_results TEXT DEFAULT '[]',
            error_message TEXT,
            FOREIGN KEY (config_id) REFERENCES performance_test_configs(id) ON DELETE CASCADE,
            FOREIGN KEY (scenario_id) REFERENCES test_scenarios(id) ON DELETE CASCADE
        )",
        [],
    )?;

    Ok(())
}

pub fn get_all_endpoints() -> Result<Vec<ApiEndpoint>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB connection error: {}", e))?;

    let mut stmt = conn.prepare("SELECT id, project_id, name, method, path, service, description, category, parameters, explanation, responses FROM endpoints")
        .map_err(|e| format!("Prepare error: {}", e))?;

    let endpoints = stmt.query_map([], |row| {
        let params_json: String = row.get(8)?;
        let parameters: Vec<crate::types::ApiParameter> = serde_json::from_str(&params_json)
            .unwrap_or_default();
        
        let responses_json: String = row.get::<_, Option<String>>(10)?.unwrap_or_else(|| "[]".to_string());
        let responses: Vec<crate::types::ApiResponseDefinition> = serde_json::from_str(&responses_json)
            .unwrap_or_default();

        Ok(ApiEndpoint {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            method: row.get(3)?,
            path: row.get(4)?,
            service: row.get(5)?,
            description: row.get(6)?,
            category: row.get(7)?,
            parameters,
            explanation: row.get(9)?,
            responses: Some(responses),
        })
    })
    .map_err(|e| format!("Query error: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Collection error: {}", e))?;

    Ok(endpoints)
}

pub fn save_endpoint(endpoint: ApiEndpoint) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let params_json = serde_json::to_string(&endpoint.parameters)
        .map_err(|e| format!("Serialization error: {}", e))?;

    let responses_json = serde_json::to_string(&endpoint.responses.unwrap_or_default())
        .map_err(|e| format!("Serialization error: {}", e))?;

    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT OR REPLACE INTO endpoints
        (id, project_id, name, method, path, service, description, category, parameters, explanation, responses, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            endpoint.id,
            endpoint.project_id,
            endpoint.name,
            endpoint.method,
            endpoint.path,
            endpoint.service,
            endpoint.description,
            endpoint.category,
            params_json,
            endpoint.explanation,
            responses_json,
            now
        ],
    )
    .map_err(|e| format!("Insert error: {}", e))?;

    Ok(())
}

// Project management functions
pub fn save_project(project: Project) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO projects (id, name, path, created_at, last_scanned, base_url)
        VALUES (?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            project.id,
            project.name,
            project.path,
            project.created_at,
            project.last_scanned,
            project.base_url
        ],
    )
    .map_err(|e| format!("Insert error: {}", e))?;

    Ok(())
}

pub fn get_all_projects() -> Result<Vec<Project>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB connection error: {}", e))?;

    let mut stmt = conn.prepare("SELECT id, name, path, created_at, last_scanned, base_url FROM projects ORDER BY created_at DESC")
        .map_err(|e| format!("Prepare error: {}", e))?;

    let projects = stmt.query_map([], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            created_at: row.get(3)?,
            last_scanned: row.get(4)?,
            base_url: row.get(5)?,
        })
    })
    .map_err(|e| format!("Query error: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Collection error: {}", e))?;

    Ok(projects)
}

/// Get a single project by ID
pub fn get_project(project_id: &str) -> Result<Option<Project>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB connection error: {}", e))?;

    let mut stmt = conn.prepare("SELECT id, name, path, created_at, last_scanned, base_url FROM projects WHERE id = ?")
        .map_err(|e| format!("Prepare error: {}", e))?;

    let project_result = stmt.query_row([project_id], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            created_at: row.get(3)?,
            last_scanned: row.get(4)?,
            base_url: row.get(5)?,
        })
    });

    match project_result {
        Ok(p) => Ok(Some(p)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Query error: {}", e)),
    }
}

pub fn delete_project(project_id: String) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    // Delete associated endpoints first
    conn.execute(
        "DELETE FROM endpoints WHERE project_id = ?",
        rusqlite::params![project_id],
    )
    .map_err(|e| format!("Delete endpoints error: {}", e))?;

    // Delete project
    conn.execute(
        "DELETE FROM projects WHERE id = ?",
        rusqlite::params![project_id],
    )
    .map_err(|e| format!("Delete project error: {}", e))?;

    Ok(())
}

pub fn get_endpoints_by_project(project_id: String) -> Result<Vec<ApiEndpoint>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB connection error: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, method, path, service, description, category, parameters, explanation, responses 
         FROM endpoints WHERE project_id = ?"
    )
    .map_err(|e| format!("Prepare error: {}", e))?;

    let endpoints = stmt.query_map([&project_id], |row| {
        let params_json: String = row.get(8)?;
        let parameters: Vec<crate::types::ApiParameter> = serde_json::from_str(&params_json)
            .unwrap_or_default();
        
        let responses_json: String = row.get::<_, Option<String>>(10)?.unwrap_or_else(|| "[]".to_string());
        let responses: Vec<crate::types::ApiResponseDefinition> = serde_json::from_str(&responses_json)
            .unwrap_or_default();

        Ok(ApiEndpoint {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            method: row.get(3)?,
            path: row.get(4)?,
            service: row.get(5)?,
            description: row.get(6)?,
            category: row.get(7)?,
            parameters,
            explanation: row.get(9)?,
            responses: Some(responses),
        })
    })
    .map_err(|e| format!("Query error: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Collection error: {}", e))?;

    Ok(endpoints)
}

pub fn clear_project_endpoints(project_id: &str) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    conn.execute(
        "DELETE FROM endpoints WHERE project_id = ?",
        rusqlite::params![project_id],
    )
    .map_err(|e| format!("Delete error: {}", e))?;

    Ok(())
}

pub fn update_project_last_scanned(project_id: &str) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "UPDATE projects SET last_scanned = ? WHERE id = ?",
        rusqlite::params![now, project_id],
    )
    .map_err(|e| format!("Update error: {}", e))?;

    Ok(())
}

pub fn update_project_base_url(project_id: &str, base_url: Option<String>) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    conn.execute(
        "UPDATE projects SET base_url = ? WHERE id = ?",
        rusqlite::params![base_url, project_id],
    )
    .map_err(|e| format!("Update error: {}", e))?;

    Ok(())
}

pub fn get_all_test_suites() -> Result<Vec<TestSuite>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let mut stmt = conn.prepare("SELECT id, name, description, endpoints, category FROM test_suites")
        .map_err(|e| format!("Prepare error: {}", e))?;

    let suites = stmt.query_map([], |row| {
        let endpoints_json: String = row.get(3)?;
        let endpoints: Vec<String> = serde_json::from_str(&endpoints_json)
            .unwrap_or_default();

        Ok(TestSuite {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            endpoints,
            category: row.get(4)?,
        })
    })
    .map_err(|e| format!("Query error: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Collection error: {}", e))?;

    Ok(suites)
}

pub fn execute_sql_query(db_path: String, query: String) -> Result<QueryResult, String> {
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("DB connection error: {}", e))?;

    let mut stmt = conn.prepare(&query)
        .map_err(|e| format!("SQL error: {}", e))?;

    let column_count = stmt.column_count();
    let columns: Vec<String> = stmt.column_names()
        .iter()
        .map(|s| s.to_string())
        .collect();

    let rows: Vec<Vec<serde_json::Value>> = stmt.query_map([], |row| {
        let mut values = Vec::new();
        for i in 0..column_count {
            // Get the raw SQLite value type and convert appropriately
            let value = match row.get_ref(i) {
                Ok(value_ref) => {
                    use rusqlite::types::ValueRef;
                    match value_ref {
                        ValueRef::Null => serde_json::Value::Null,
                        ValueRef::Integer(i) => serde_json::json!(i),
                        ValueRef::Real(f) => serde_json::json!(f),
                        ValueRef::Text(s) => {
                            serde_json::json!(String::from_utf8_lossy(s))
                        },
                        ValueRef::Blob(_) => {
                            // For binary data, return a placeholder string
                            serde_json::json!("<binary data>")
                        }
                    }
                },
                Err(_) => serde_json::Value::Null
            };
            values.push(value);
        }
        Ok(values)
    })
    .map_err(|e| format!("Query execution error: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Row collection error: {}", e))?;

    let row_count = rows.len();

    Ok(QueryResult {
        columns,
        rows,
        row_count,
    })
}

// Security test case functions
pub fn save_security_test_case(test_case: SecurityTestCase) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let scans_json = serde_json::to_string(&test_case.scans)
        .map_err(|e| format!("Serialization error: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO security_test_cases 
        (id, project_id, name, endpoint_id, scans, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            test_case.id,
            test_case.project_id,
            test_case.name,
            test_case.endpoint_id,
            scans_json,
            test_case.created_at,
            test_case.updated_at
        ],
    )
    .map_err(|e| format!("Insert error: {}", e))?;

    Ok(())
}

pub fn get_security_test_cases_by_project(project_id: &str) -> Result<Vec<SecurityTestCase>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, endpoint_id, scans, created_at, updated_at 
         FROM security_test_cases WHERE project_id = ?"
    )
    .map_err(|e| format!("Prepare error: {}", e))?;

    let cases = stmt.query_map([project_id], |row| {
        let scans_json: String = row.get(4)?;
        let scans: Vec<ScanConfig> = serde_json::from_str(&scans_json).unwrap_or_default();

        Ok(SecurityTestCase {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            endpoint_id: row.get(3)?,
            scans,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })
    .map_err(|e| format!("Query error: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Collection error: {}", e))?;

    Ok(cases)
}

pub fn delete_security_test_case(id: &str) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    conn.execute(
        "DELETE FROM security_test_runs WHERE test_case_id = ?",
        rusqlite::params![id],
    ).ok();

    conn.execute(
        "DELETE FROM security_test_cases WHERE id = ?",
        rusqlite::params![id],
    )
    .map_err(|e| format!("Delete error: {}", e))?;

    Ok(())
}

pub fn save_security_test_run(run: &SecurityTestRun) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let results_json = serde_json::to_string(&run.results)
        .map_err(|e| format!("Serialization error: {}", e))?;

    let status_str = match run.status {
        crate::security::types::ScanStatus::Pass => "Pass",
        crate::security::types::ScanStatus::Fail => "Fail",
        crate::security::types::ScanStatus::Running => "Running",
        crate::security::types::ScanStatus::Pending => "Pending",
        crate::security::types::ScanStatus::Error => "Error",
    };

    conn.execute(
        "INSERT INTO security_test_runs 
        (id, test_case_id, status, total_scans, completed_scans, total_requests, total_alerts, results, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            run.id,
            run.test_case_id,
            status_str,
            run.total_scans,
            run.completed_scans,
            run.total_requests,
            run.total_alerts,
            results_json,
            run.started_at,
            run.completed_at
        ],
    )
    .map_err(|e| format!("Insert error: {}", e))?;

    Ok(())
}

pub fn get_security_test_runs(test_case_id: &str) -> Result<Vec<SecurityTestRun>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT id, test_case_id, status, total_scans, completed_scans, total_requests, total_alerts, results, started_at, completed_at 
         FROM security_test_runs WHERE test_case_id = ? ORDER BY started_at DESC"
    )
    .map_err(|e| format!("Prepare error: {}", e))?;

    let runs = stmt.query_map([test_case_id], |row| {
        let status_str: String = row.get(2)?;
        let status = match status_str.as_str() {
            "Pass" => crate::security::types::ScanStatus::Pass,
            "Fail" => crate::security::types::ScanStatus::Fail,
            "Running" => crate::security::types::ScanStatus::Running,
            "Error" => crate::security::types::ScanStatus::Error,
            _ => crate::security::types::ScanStatus::Pending,
        };

        let results_json: String = row.get(7)?;
        let results = serde_json::from_str(&results_json).unwrap_or_default();

        Ok(SecurityTestRun {
            id: row.get(0)?,
            test_case_id: row.get(1)?,
            status,
            total_scans: row.get(3)?,
            completed_scans: row.get(4)?,
            total_requests: row.get(5)?,
            total_alerts: row.get(6)?,
            results,
            started_at: row.get(8)?,
            completed_at: row.get(9)?,
        })
    })
    .map_err(|e| format!("Query error: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Collection error: {}", e))?;

    Ok(runs)
}

// ============================================================================
// Test Scenario Functions
// ============================================================================

/// Save a test scenario to the database
pub fn save_test_scenario(scenario: TestScenario) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let variables_json = serde_json::to_string(&scenario.variables)
        .map_err(|e| format!("Serialization error: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO test_scenarios 
        (id, project_id, name, description, priority, variables, pre_script, post_script, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            scenario.id,
            scenario.project_id,
            scenario.name,
            scenario.description,
            scenario.priority,
            variables_json,
            scenario.pre_script,
            scenario.post_script,
            scenario.created_at,
            scenario.updated_at
        ],
    )
    .map_err(|e| format!("Insert error: {}", e))?;

    Ok(())
}

/// Get all test scenarios for a project
pub fn get_test_scenarios_by_project(project_id: &str) -> Result<Vec<TestScenario>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, description, priority, variables, pre_script, post_script, created_at, updated_at 
         FROM test_scenarios WHERE project_id = ? ORDER BY created_at DESC"
    )
    .map_err(|e| format!("Prepare error: {}", e))?;

    let scenarios = stmt.query_map([project_id], |row| {
        let variables_json: String = row.get(5)?;
        let variables: serde_json::Value = serde_json::from_str(&variables_json)
            .unwrap_or(serde_json::json!({}));

        Ok(TestScenario {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            priority: row.get(4)?,
            variables,
            pre_script: row.get(6)?,
            post_script: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    })
    .map_err(|e| format!("Query error: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Collection error: {}", e))?;

    Ok(scenarios)
}

/// Get a single test scenario by ID
pub fn get_test_scenario(scenario_id: &str) -> Result<Option<TestScenario>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, description, priority, variables, pre_script, post_script, created_at, updated_at 
         FROM test_scenarios WHERE id = ?"
    )
    .map_err(|e| format!("Prepare error: {}", e))?;

    let scenario = stmt.query_row([scenario_id], |row| {
        let variables_json: String = row.get(5)?;
        let variables: serde_json::Value = serde_json::from_str(&variables_json)
            .unwrap_or(serde_json::json!({}));

        Ok(TestScenario {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            priority: row.get(4)?,
            variables,
            pre_script: row.get(6)?,
            post_script: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    });

    match scenario {
        Ok(s) => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Query error: {}", e)),
    }
}

/// Delete a test scenario and all its steps
pub fn delete_test_scenario(scenario_id: &str) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    // Delete associated runs first
    conn.execute(
        "DELETE FROM test_scenario_runs WHERE scenario_id = ?",
        rusqlite::params![scenario_id],
    ).ok();

    // Delete associated steps
    conn.execute(
        "DELETE FROM test_scenario_steps WHERE scenario_id = ?",
        rusqlite::params![scenario_id],
    ).ok();

    // Delete scenario
    conn.execute(
        "DELETE FROM test_scenarios WHERE id = ?",
        rusqlite::params![scenario_id],
    )
    .map_err(|e| format!("Delete error: {}", e))?;

    Ok(())
}

/// Save a test scenario step
pub fn save_test_scenario_step(step: TestScenarioStep) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let config_json = serde_json::to_string(&step.config)
        .map_err(|e| format!("Serialization error: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO test_scenario_steps 
        (id, scenario_id, step_order, step_type, name, config, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            step.id,
            step.scenario_id,
            step.step_order,
            step.step_type.as_str(),
            step.name,
            config_json,
            step.enabled as i32
        ],
    )
    .map_err(|e| format!("Insert error: {}", e))?;

    Ok(())
}

/// Get all steps for a scenario
pub fn get_test_scenario_steps(scenario_id: &str) -> Result<Vec<TestScenarioStep>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT id, scenario_id, step_order, step_type, name, config, enabled 
         FROM test_scenario_steps WHERE scenario_id = ? ORDER BY step_order ASC"
    )
    .map_err(|e| format!("Prepare error: {}", e))?;

    let steps = stmt.query_map([scenario_id], |row| {
        let config_json: String = row.get(5)?;
        let config: serde_json::Value = serde_json::from_str(&config_json)
            .unwrap_or(serde_json::json!({}));
        let step_type_str: String = row.get(3)?;
        let enabled: i32 = row.get(6)?;

        Ok(TestScenarioStep {
            id: row.get(0)?,
            scenario_id: row.get(1)?,
            step_order: row.get(2)?,
            step_type: TestStepType::from_str(&step_type_str),
            name: row.get(4)?,
            config,
            enabled: enabled != 0,
        })
    })
    .map_err(|e| format!("Query error: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Collection error: {}", e))?;

    Ok(steps)
}

/// Get a test scenario step by ID
pub fn get_test_scenario_step_by_id(step_id: &str) -> Result<Option<TestScenarioStep>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT id, scenario_id, step_order, step_type, name, config, enabled 
         FROM test_scenario_steps WHERE id = ?"
    )
    .map_err(|e| format!("Prepare error: {}", e))?;

    let step_result = stmt.query_row([step_id], |row| {
        let config_json: String = row.get(5)?;
        let config: serde_json::Value = serde_json::from_str(&config_json)
            .unwrap_or(serde_json::json!({}));
        let step_type_str: String = row.get(3)?;
        let enabled: i32 = row.get(6)?;

        Ok(TestScenarioStep {
            id: row.get(0)?,
            scenario_id: row.get(1)?,
            step_order: row.get(2)?,
            step_type: TestStepType::from_str(&step_type_str),
            name: row.get(4)?,
            config,
            enabled: enabled != 0,
        })
    });

    match step_result {
        Ok(step) => Ok(Some(step)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Query error: {}", e)),
    }
}

/// Delete a test scenario step
pub fn delete_test_scenario_step(step_id: &str) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    conn.execute(
        "DELETE FROM test_scenario_steps WHERE id = ?",
        rusqlite::params![step_id],
    )
    .map_err(|e| format!("Delete error: {}", e))?;

    Ok(())
}

/// Reorder steps in a scenario
pub fn reorder_test_scenario_steps(scenario_id: &str, step_ids: &[String]) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    for (index, step_id) in step_ids.iter().enumerate() {
        conn.execute(
            "UPDATE test_scenario_steps SET step_order = ? WHERE id = ? AND scenario_id = ?",
            rusqlite::params![index as i32, step_id, scenario_id],
        )
        .map_err(|e| format!("Update error: {}", e))?;
    }

    Ok(())
}

/// Save a test scenario run
pub fn save_test_scenario_run(run: &TestScenarioRun) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let results_json = serde_json::to_string(&run.results)
        .map_err(|e| format!("Serialization error: {}", e))?;
    
    let variables_json = serde_json::to_string(&run.variables)
        .map_err(|e| format!("Serialization error: {}", e))?;

    conn.execute(
        "INSERT INTO test_scenario_runs 
        (id, scenario_id, status, total_steps, passed_steps, failed_steps, skipped_steps, 
         duration_ms, started_at, completed_at, error_message, results, variables)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            run.id,
            run.scenario_id,
            run.status.as_str(),
            run.total_steps,
            run.passed_steps,
            run.failed_steps,
            run.skipped_steps,
            run.duration_ms,
            run.started_at,
            run.completed_at,
            run.error_message,
            results_json,
            variables_json
        ],
    )
    .map_err(|e| format!("Insert error: {}", e))?;

    Ok(())
}

/// Get test scenario runs for a scenario
pub fn get_test_scenario_runs(scenario_id: &str) -> Result<Vec<TestScenarioRun>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT id, scenario_id, status, total_steps, passed_steps, failed_steps, skipped_steps,
                duration_ms, started_at, completed_at, error_message, results, variables
         FROM test_scenario_runs WHERE scenario_id = ? ORDER BY started_at DESC"
    )
    .map_err(|e| format!("Prepare error: {}", e))?;

    let runs = stmt.query_map([scenario_id], |row| {
        let status_str: String = row.get(2)?;
        let results_json: String = row.get(11)?;
        let variables_json: String = row.get(12)?;

        Ok(TestScenarioRun {
            id: row.get(0)?,
            scenario_id: row.get(1)?,
            status: ScenarioRunStatus::from_str(&status_str),
            total_steps: row.get(3)?,
            passed_steps: row.get(4)?,
            failed_steps: row.get(5)?,
            skipped_steps: row.get(6)?,
            duration_ms: row.get(7)?,
            started_at: row.get(8)?,
            completed_at: row.get(9)?,
            error_message: row.get(10)?,
            results: serde_json::from_str(&results_json).unwrap_or_default(),
            variables: serde_json::from_str(&variables_json).unwrap_or_default(),
        })
    })
    .map_err(|e| format!("Query error: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Collection error: {}", e))?;

    Ok(runs)
}

// ============================================================================
// YAML Files Functions
// ============================================================================

/// Save a YAML file to the database
pub fn save_yaml_file(yaml_file: YamlFile) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO yaml_files 
        (id, project_id, scenario_id, content, created_at)
        VALUES (?, ?, ?, ?, ?)",
        rusqlite::params![
            yaml_file.id,
            yaml_file.project_id,
            yaml_file.scenario_id,
            yaml_file.content,
            yaml_file.created_at
        ],
    )
    .map_err(|e| format!("Insert error: {}", e))?;

    Ok(())
}

/// Get all YAML files for a project
pub fn get_yaml_files_by_project(project_id: &str) -> Result<Vec<YamlFile>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT id, project_id, scenario_id, content, created_at 
         FROM yaml_files WHERE project_id = ? ORDER BY created_at DESC"
    )
    .map_err(|e| format!("Prepare error: {}", e))?;

    let files = stmt.query_map([project_id], |row| {
        Ok(YamlFile {
            id: row.get(0)?,
            project_id: row.get(1)?,
            scenario_id: row.get(2)?,
            content: row.get(3)?,
            created_at: row.get(4)?,
        })
    })
    .map_err(|e| format!("Query error: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Collection error: {}", e))?;

    Ok(files)
}

/// Get a single YAML file by ID
pub fn get_yaml_file(id: &str) -> Result<Option<YamlFile>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT id, project_id, scenario_id, content, created_at 
         FROM yaml_files WHERE id = ?"
    )
    .map_err(|e| format!("Prepare error: {}", e))?;

    let yaml_file = stmt.query_row([id], |row| {
        Ok(YamlFile {
            id: row.get(0)?,
            project_id: row.get(1)?,
            scenario_id: row.get(2)?,
            content: row.get(3)?,
            created_at: row.get(4)?,
        })
    });

    match yaml_file {
        Ok(f) => Ok(Some(f)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Query error: {}", e)),
    }
}

/// Delete a YAML file by ID
pub fn delete_yaml_file(id: &str) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    conn.execute(
        "DELETE FROM yaml_files WHERE id = ?",
        rusqlite::params![id],
    )
    .map_err(|e| format!("Delete error: {}", e))?;

    Ok(())
}

// ============================================================================
// Performance Test Functions
// ============================================================================

/// Save a performance test configuration
pub fn save_performance_test_config(config: PerformanceTestConfig) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let stages_json = serde_json::to_string(&config.stages.unwrap_or_default())
        .map_err(|e| format!("Serialization error: {}", e))?;

    let thresholds_json = serde_json::to_string(&config.thresholds)
        .map_err(|e| format!("Serialization error: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO performance_test_configs 
        (id, scenario_id, name, test_type, vus, duration_secs, iterations, stages, thresholds, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            config.id,
            config.scenario_id,
            config.name,
            config.test_type.as_str(),
            config.vus,
            config.duration_secs,
            config.iterations,
            stages_json,
            thresholds_json,
            config.created_at,
            config.updated_at
        ],
    )
    .map_err(|e| format!("Insert error: {}", e))?;

    Ok(())
}

/// Get all performance test configs for a scenario
pub fn get_performance_test_configs(scenario_id: &str) -> Result<Vec<PerformanceTestConfig>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT id, scenario_id, name, test_type, vus, duration_secs, iterations, stages, thresholds, created_at, updated_at 
         FROM performance_test_configs WHERE scenario_id = ? ORDER BY created_at DESC"
    )
    .map_err(|e| format!("Prepare error: {}", e))?;

    let configs = stmt.query_map([scenario_id], |row| {
        let test_type_str: String = row.get(3)?;
        let stages_json: String = row.get(7)?;
        let thresholds_json: String = row.get(8)?;

        let stages: Option<Vec<Stage>> = serde_json::from_str(&stages_json).ok();
        let thresholds: Vec<Threshold> = serde_json::from_str(&thresholds_json).unwrap_or_default();

        Ok(PerformanceTestConfig {
            id: row.get(0)?,
            scenario_id: row.get(1)?,
            name: row.get(2)?,
            test_type: PerformanceTestType::from_str(&test_type_str),
            vus: row.get(4)?,
            duration_secs: row.get(5)?,
            iterations: row.get(6)?,
            stages,
            thresholds,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    })
    .map_err(|e| format!("Query error: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Collection error: {}", e))?;

    Ok(configs)
}

/// Get a single performance test config by ID
pub fn get_performance_test_config(config_id: &str) -> Result<Option<PerformanceTestConfig>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT id, scenario_id, name, test_type, vus, duration_secs, iterations, stages, thresholds, created_at, updated_at 
         FROM performance_test_configs WHERE id = ?"
    )
    .map_err(|e| format!("Prepare error: {}", e))?;

    let config = stmt.query_row([config_id], |row| {
        let test_type_str: String = row.get(3)?;
        let stages_json: String = row.get(7)?;
        let thresholds_json: String = row.get(8)?;

        let stages: Option<Vec<Stage>> = serde_json::from_str(&stages_json).ok();
        let thresholds: Vec<Threshold> = serde_json::from_str(&thresholds_json).unwrap_or_default();

        Ok(PerformanceTestConfig {
            id: row.get(0)?,
            scenario_id: row.get(1)?,
            name: row.get(2)?,
            test_type: PerformanceTestType::from_str(&test_type_str),
            vus: row.get(4)?,
            duration_secs: row.get(5)?,
            iterations: row.get(6)?,
            stages,
            thresholds,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    });

    match config {
        Ok(c) => Ok(Some(c)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Query error: {}", e)),
    }
}

/// Delete a performance test config and its runs
pub fn delete_performance_test_config(config_id: &str) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    // Delete associated runs first
    conn.execute(
        "DELETE FROM performance_test_runs WHERE config_id = ?",
        rusqlite::params![config_id],
    ).ok();

    // Delete config
    conn.execute(
        "DELETE FROM performance_test_configs WHERE id = ?",
        rusqlite::params![config_id],
    )
    .map_err(|e| format!("Delete error: {}", e))?;

    Ok(())
}

/// Save a performance test run
pub fn save_performance_test_run(run: &PerformanceTestRun) -> Result<(), String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let metrics_json = serde_json::to_string(&run.metrics)
        .map_err(|e| format!("Serialization error: {}", e))?;

    let threshold_results_json = serde_json::to_string(&run.threshold_results)
        .map_err(|e| format!("Serialization error: {}", e))?;

    conn.execute(
        "INSERT INTO performance_test_runs 
        (id, config_id, scenario_id, status, started_at, completed_at, duration_ms, max_vus_reached, metrics, threshold_results, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            run.id,
            run.config_id,
            run.scenario_id,
            run.status.as_str(),
            run.started_at,
            run.completed_at,
            run.duration_ms,
            run.max_vus_reached,
            metrics_json,
            threshold_results_json,
            run.error_message
        ],
    )
    .map_err(|e| format!("Insert error: {}", e))?;

    Ok(())
}

/// Get performance test runs for a config
pub fn get_performance_test_runs(config_id: &str) -> Result<Vec<PerformanceTestRun>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT id, config_id, scenario_id, status, started_at, completed_at, duration_ms, max_vus_reached, metrics, threshold_results, error_message 
         FROM performance_test_runs WHERE config_id = ? ORDER BY started_at DESC"
    )
    .map_err(|e| format!("Prepare error: {}", e))?;

    let runs = stmt.query_map([config_id], |row| {
        let status_str: String = row.get(3)?;
        let metrics_json: String = row.get(8)?;
        let threshold_results_json: String = row.get(9)?;

        Ok(PerformanceTestRun {
            id: row.get(0)?,
            config_id: row.get(1)?,
            scenario_id: row.get(2)?,
            status: PerformanceRunStatus::from_str(&status_str),
            started_at: row.get(4)?,
            completed_at: row.get(5)?,
            duration_ms: row.get(6)?,
            max_vus_reached: row.get::<_, Option<u32>>(7)?.unwrap_or(0),
            metrics: serde_json::from_str(&metrics_json).ok(),
            threshold_results: serde_json::from_str(&threshold_results_json).unwrap_or_default(),
            error_message: row.get(10)?,
        })
    })
    .map_err(|e| format!("Query error: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Collection error: {}", e))?;

    Ok(runs)
}

/// Get a single performance test run by ID
pub fn get_performance_test_run(run_id: &str) -> Result<Option<PerformanceTestRun>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB error: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT id, config_id, scenario_id, status, started_at, completed_at, duration_ms, max_vus_reached, metrics, threshold_results, error_message 
         FROM performance_test_runs WHERE id = ?"
    )
    .map_err(|e| format!("Prepare error: {}", e))?;

    let run = stmt.query_row([run_id], |row| {
        let status_str: String = row.get(3)?;
        let metrics_json: String = row.get(8)?;
        let threshold_results_json: String = row.get(9)?;

        Ok(PerformanceTestRun {
            id: row.get(0)?,
            config_id: row.get(1)?,
            scenario_id: row.get(2)?,
            status: PerformanceRunStatus::from_str(&status_str),
            started_at: row.get(4)?,
            completed_at: row.get(5)?,
            duration_ms: row.get(6)?,
            max_vus_reached: row.get::<_, Option<u32>>(7)?.unwrap_or(0),
            metrics: serde_json::from_str(&metrics_json).ok(),
            threshold_results: serde_json::from_str(&threshold_results_json).unwrap_or_default(),
            error_message: row.get(10)?,
        })
    });

    match run {
        Ok(r) => Ok(Some(r)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Query error: {}", e)),
    }
}
