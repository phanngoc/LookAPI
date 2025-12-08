//! CSV file reader for test scenario data
//! 
//! This module provides functionality to read CSV files and convert them to
//! HashMap records that can be used in test scenarios with `with_items_from_csv`.

use std::collections::HashMap;
use std::error::Error;
use std::fs::File;
use std::path::Path;
use csv::ReaderBuilder;
use super::types::{CsvConfig, CsvPreview};

/// Read CSV file and return as a vector of HashMaps
/// Each HashMap represents one row with column names as keys
pub fn read_csv_to_records(
    file_path: &str,
    config: &CsvConfig,
) -> Result<Vec<HashMap<String, String>>, Box<dyn Error>> {
    log::info!("[CSV] Reading CSV file: {}", file_path);
    
    let path = Path::new(file_path);
    if !path.exists() {
        let error = format!("CSV file not found: {}", file_path);
        log::error!("[CSV] {}", error);
        return Err(error.into());
    }

    let file = File::open(path)?;
    let mut reader = ReaderBuilder::new()
        .delimiter(config.delimiter.unwrap_or(',') as u8)
        .quote(config.quote_char.unwrap_or('"') as u8)
        .from_reader(file);

    let headers = reader.headers()?.clone();
    log::debug!("[CSV] Headers: {:?}", headers);
    
    let mut records = Vec::new();
    
    for (idx, result) in reader.records().enumerate() {
        let record = result?;
        let mut row_map = HashMap::new();
        
        for (i, field) in record.iter().enumerate() {
            if let Some(header) = headers.get(i) {
                row_map.insert(header.to_string(), field.to_string());
            }
        }
        
        log::trace!("[CSV] Row {}: {:?}", idx, row_map);
        records.push(row_map);
    }
    
    log::info!("[CSV] Successfully read {} rows from {}", records.len(), file_path);
    Ok(records)
}

/// Preview CSV file (first N rows) for UI display
pub fn preview_csv_file(
    file_path: &str,
    config: &CsvConfig,
    max_rows: usize,
) -> Result<CsvPreview, Box<dyn Error>> {
    log::info!("[CSV] Previewing CSV file: {} (max {} rows)", file_path, max_rows);
    
    let path = Path::new(file_path);
    if !path.exists() {
        let error = format!("CSV file not found: {}", file_path);
        log::error!("[CSV] {}", error);
        return Err(error.into());
    }

    let file = File::open(path)?;
    let mut reader = ReaderBuilder::new()
        .delimiter(config.delimiter.unwrap_or(',') as u8)
        .quote(config.quote_char.unwrap_or('"') as u8)
        .from_reader(file);

    let headers: Vec<String> = reader.headers()?
        .iter()
        .map(|h| h.to_string())
        .collect();
    
    log::debug!("[CSV] Preview headers: {:?}", headers);
    
    let mut rows = Vec::new();
    let mut total_rows = 0;
    
    for result in reader.records() {
        total_rows += 1;
        
        if rows.len() < max_rows {
            let record = result?;
            let row: Vec<String> = record.iter()
                .map(|f| f.to_string())
                .collect();
            rows.push(row);
        }
    }
    
    log::info!("[CSV] Preview: {} headers, {} sample rows, {} total rows", 
        headers.len(), rows.len(), total_rows);
    
    Ok(CsvPreview {
        headers,
        rows,
        total_rows,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_csv_parsing() {
        // This test would require a test CSV file
        // In production, you would create a temporary CSV for testing
    }
}
