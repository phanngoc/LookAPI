use tauri_app_lib::scanner::UnifiedScanner;
use std::path::PathBuf;

#[tokio::main]
async fn main() {
    let project_path = PathBuf::from("/home/phan.ngoc@sun-asterisk.com/Documents/projects/jal-issue/ft-migration-fb-admin-dcmain-api");
    
    println!("Starting scan for project: {:?}", project_path);
    
    if !project_path.exists() {
        eprintln!("Error: Project path does not exist!");
        std::process::exit(1);
    }
    
    let scanner = UnifiedScanner::new(project_path);
    
    match scanner.scan().await {
        Ok(result) => {
            println!("\n=== Scan Results ===");
            println!("Framework Type: {}", result.framework_info.framework_type);
            println!("Framework: {}", result.framework_info.framework);
            if let Some(ref version) = result.framework_info.version {
                println!("Version: {}", version);
            }
            println!("Scan Method: {}", result.scan_method);
            println!("\nFound {} endpoints:\n", result.endpoints.len());
            
            for (i, endpoint) in result.endpoints.iter().enumerate() {
                println!("{}. {} {}", 
                    i + 1,
                    endpoint.method,
                    endpoint.path
                );
                println!("   Controller: {}@{}", endpoint.controller, endpoint.action);
                if !endpoint.file_path.is_empty() {
                    println!("   File: {}", endpoint.file_path);
                }
                println!("   Parameters: {}", endpoint.parameters.len());
                for param in &endpoint.parameters {
                    println!("     - {} ({}) [{}] required: {}", 
                        param.name, 
                        param.param_type,
                        param.source,
                        param.required
                    );
                }
                println!();
            }
            
            println!("Total: {} endpoints", result.endpoints.len());
        }
        Err(e) => {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
    }
}

