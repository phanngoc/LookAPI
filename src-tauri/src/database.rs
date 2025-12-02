use crate::types::{ApiEndpoint, TestSuite, QueryResult};
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

    conn.execute(
        "CREATE TABLE IF NOT EXISTS endpoints (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            method TEXT NOT NULL,
            path TEXT NOT NULL,
            service TEXT NOT NULL,
            description TEXT,
            category TEXT,
            parameters TEXT NOT NULL DEFAULT '[]',
            explanation TEXT,
            created_at INTEGER,
            updated_at INTEGER
        )",
        [],
    )?;

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

    Ok(())
}

pub fn get_all_endpoints() -> Result<Vec<ApiEndpoint>, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| format!("DB connection error: {}", e))?;

    let mut stmt = conn.prepare("SELECT id, name, method, path, service, description, category, parameters FROM endpoints")
        .map_err(|e| format!("Prepare error: {}", e))?;

    let endpoints = stmt.query_map([], |row| {
        let params_json: String = row.get(7)?;
        let parameters: Vec<crate::types::ApiParameter> = serde_json::from_str(&params_json)
            .unwrap_or_default();

        Ok(ApiEndpoint {
            id: row.get(0)?,
            name: row.get(1)?,
            method: row.get(2)?,
            path: row.get(3)?,
            service: row.get(4)?,
            description: row.get(5)?,
            category: row.get(6)?,
            parameters,
            explanation: None,
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

    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT OR REPLACE INTO endpoints
        (id, name, method, path, service, description, category, parameters, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            endpoint.id,
            endpoint.name,
            endpoint.method,
            endpoint.path,
            endpoint.service,
            endpoint.description,
            endpoint.category,
            params_json,
            now
        ],
    )
    .map_err(|e| format!("Insert error: {}", e))?;

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
