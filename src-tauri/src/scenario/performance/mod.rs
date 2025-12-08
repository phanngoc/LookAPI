//! Performance Testing Module
//!
//! This module provides performance testing capabilities for test scenarios,
//! inspired by k6's approach but integrated directly into the Rust backend.
//!
//! # Features
//!
//! - **Multiple VUs**: Run scenarios with configurable virtual users
//! - **Ramping Stages**: Gradually increase/decrease VUs over time
//! - **Metrics Collection**: Track response times, error rates, throughput
//! - **Thresholds**: Define pass/fail criteria
//! - **Real-time Events**: Stream progress updates to frontend
//!
//! # Test Types
//!
//! - **Smoke**: Quick sanity check with few VUs
//! - **Load**: Baseline test with typical load
//! - **Stress**: Find breaking point with high load
//! - **Spike**: Test sudden traffic spikes
//! - **Soak**: Long-duration test for memory leaks
//!
//! # Example Usage
//!
//! ```rust,ignore
//! use crate::scenario::performance::{
//!     run_performance_test,
//!     PerformanceTestConfig,
//!     Stage,
//! };
//!
//! let config = PerformanceTestConfig {
//!     id: "test-1".to_string(),
//!     scenario_id: "scenario-1".to_string(),
//!     name: "Load Test".to_string(),
//!     test_type: PerformanceTestType::Load,
//!     vus: Some(50),
//!     duration_secs: Some(300),
//!     stages: None,
//!     thresholds: vec![
//!         Threshold {
//!             metric: "http_req_duration".to_string(),
//!             condition: "p(95)<500".to_string(),
//!         },
//!     ],
//!     created_at: 0,
//!     updated_at: 0,
//! };
//!
//! let result = run_performance_test(scenario, steps, config, base_url, app_handle).await;
//! ```

pub mod types;
pub mod metrics;
pub mod stages;
pub mod executor;

// Re-export commonly used types
pub use types::{
    PerformanceTestType,
    PerformanceTestConfig,
    CreatePerformanceTestInput,
    PerformanceTestRun,
    PerformanceRunStatus,
    Stage,
    Threshold,
    ThresholdResult,
    RequestMetric,
    AggregatedMetrics,
    StepMetrics,
    // Events
    PerfStartedEvent,
    PerfProgressEvent,
    PerfRequestCompletedEvent,
    PerfStageChangedEvent,
    PerfCompletedEvent,
};

pub use metrics::MetricsCollector;
pub use stages::{
    StageScheduler,
    create_smoke_test_stages,
    create_load_test_stages,
    create_stress_test_stages,
    create_spike_test_stages,
    create_soak_test_stages,
};
pub use executor::run_performance_test;
