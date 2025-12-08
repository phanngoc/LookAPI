use super::types::*;
use std::collections::HashMap;
use std::time::Instant;
use regex::Regex;

/// MetricsCollector - Thread-safe collector for performance metrics
pub struct MetricsCollector {
    metrics: Vec<RequestMetric>,
    start_time: Instant,
    iterations_completed: HashMap<u32, u64>, // vu_id -> iteration count
}

impl MetricsCollector {
    pub fn new() -> Self {
        Self {
            metrics: Vec::new(),
            start_time: Instant::now(),
            iterations_completed: HashMap::new(),
        }
    }

    /// Record a new request metric
    pub fn record(&mut self, metric: RequestMetric) {
        // Track iteration completion
        let vu_iterations = self.iterations_completed.entry(metric.vu_id).or_insert(0);
        if metric.iteration > *vu_iterations {
            *vu_iterations = metric.iteration;
        }
        self.metrics.push(metric);
    }

    /// Get total iterations completed across all VUs
    pub fn get_total_iterations(&self) -> u64 {
        self.iterations_completed.values().sum()
    }

    /// Get elapsed time in seconds
    pub fn get_elapsed_secs(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }

    /// Get elapsed time in milliseconds
    pub fn get_elapsed_ms(&self) -> u64 {
        self.start_time.elapsed().as_millis() as u64
    }

    /// Get current metrics count
    pub fn get_metrics_count(&self) -> usize {
        self.metrics.len()
    }

    /// Get failed requests count
    pub fn get_failed_count(&self) -> u64 {
        self.metrics.iter().filter(|m| !m.success).count() as u64
    }

    /// Calculate current RPS (requests per second)
    pub fn get_current_rps(&self) -> f64 {
        let elapsed = self.start_time.elapsed().as_secs_f64();
        if elapsed > 0.0 {
            self.metrics.len() as f64 / elapsed
        } else {
            0.0
        }
    }

    /// Calculate current error rate
    pub fn get_error_rate(&self) -> f64 {
        let total = self.metrics.len();
        if total > 0 {
            let failed = self.metrics.iter().filter(|m| !m.success).count();
            failed as f64 / total as f64
        } else {
            0.0
        }
    }

    /// Calculate p95 duration from current metrics
    pub fn get_p95_duration(&self) -> u64 {
        if self.metrics.is_empty() {
            return 0;
        }
        let mut durations: Vec<u64> = self.metrics.iter().map(|m| m.duration_ms).collect();
        durations.sort();
        percentile(&durations, 95.0)
    }

    /// Calculate all aggregated metrics
    pub fn calculate_aggregates(&self) -> AggregatedMetrics {
        if self.metrics.is_empty() {
            return AggregatedMetrics::default();
        }

        let total_requests = self.metrics.len() as u64;
        let failed_requests = self.metrics.iter().filter(|m| !m.success).count() as u64;
        let error_rate = if total_requests > 0 {
            failed_requests as f64 / total_requests as f64
        } else {
            0.0
        };

        // Calculate duration percentiles
        let mut durations: Vec<u64> = self.metrics.iter().map(|m| m.duration_ms).collect();
        durations.sort();

        let duration_min = *durations.first().unwrap_or(&0);
        let duration_max = *durations.last().unwrap_or(&0);
        let duration_avg = if !durations.is_empty() {
            durations.iter().sum::<u64>() as f64 / durations.len() as f64
        } else {
            0.0
        };
        let duration_med = percentile(&durations, 50.0);
        let duration_p90 = percentile(&durations, 90.0);
        let duration_p95 = percentile(&durations, 95.0);
        let duration_p99 = percentile(&durations, 99.0);

        // Calculate throughput
        let total_duration_ms = self.start_time.elapsed().as_millis() as u64;
        let requests_per_second = if total_duration_ms > 0 {
            total_requests as f64 / (total_duration_ms as f64 / 1000.0)
        } else {
            0.0
        };

        // Calculate per-step metrics
        let step_metrics = self.calculate_step_metrics();

        // Calculate iterations completed
        let iterations_completed = self.get_total_iterations();

        AggregatedMetrics {
            total_requests,
            failed_requests,
            error_rate,
            duration_min,
            duration_max,
            duration_avg,
            duration_med,
            duration_p90,
            duration_p95,
            duration_p99,
            requests_per_second,
            iterations_completed,
            total_duration_ms,
            step_metrics,
        }
    }

    /// Calculate metrics per step
    fn calculate_step_metrics(&self) -> HashMap<String, StepMetrics> {
        let mut step_groups: HashMap<String, Vec<&RequestMetric>> = HashMap::new();

        // Group metrics by step
        for metric in &self.metrics {
            step_groups
                .entry(metric.step_id.clone())
                .or_insert_with(Vec::new)
                .push(metric);
        }

        let mut result = HashMap::new();

        for (step_id, metrics) in step_groups {
            if metrics.is_empty() {
                continue;
            }

            let step_name = metrics.first().map(|m| m.step_name.clone()).unwrap_or_default();
            let total_requests = metrics.len() as u64;
            let failed_requests = metrics.iter().filter(|m| !m.success).count() as u64;
            let error_rate = if total_requests > 0 {
                failed_requests as f64 / total_requests as f64
            } else {
                0.0
            };

            let mut durations: Vec<u64> = metrics.iter().map(|m| m.duration_ms).collect();
            durations.sort();

            let step_metrics = StepMetrics {
                step_name,
                total_requests,
                failed_requests,
                error_rate,
                duration_min: *durations.first().unwrap_or(&0),
                duration_max: *durations.last().unwrap_or(&0),
                duration_avg: if !durations.is_empty() {
                    durations.iter().sum::<u64>() as f64 / durations.len() as f64
                } else {
                    0.0
                },
                duration_med: percentile(&durations, 50.0),
                duration_p90: percentile(&durations, 90.0),
                duration_p95: percentile(&durations, 95.0),
                duration_p99: percentile(&durations, 99.0),
            };

            result.insert(step_id, step_metrics);
        }

        result
    }

    /// Evaluate thresholds against collected metrics
    pub fn evaluate_thresholds(&self, thresholds: &[Threshold]) -> Vec<ThresholdResult> {
        let metrics = self.calculate_aggregates();
        let mut results = Vec::new();

        for threshold in thresholds {
            let result = evaluate_single_threshold(threshold, &metrics);
            results.push(result);
        }

        results
    }
}

/// Calculate percentile from a sorted slice
fn percentile(sorted_data: &[u64], p: f64) -> u64 {
    if sorted_data.is_empty() {
        return 0;
    }

    let index = (p / 100.0 * (sorted_data.len() - 1) as f64).round() as usize;
    let index = index.min(sorted_data.len() - 1);
    sorted_data[index]
}

/// Evaluate a single threshold against metrics
fn evaluate_single_threshold(threshold: &Threshold, metrics: &AggregatedMetrics) -> ThresholdResult {
    let condition = &threshold.condition;
    
    // Parse the condition - supports formats like:
    // - "p(95)<500" - percentile check
    // - "avg<200" - average check
    // - "rate<0.05" - error rate check
    // - "max<1000" - max duration check
    
    let (actual_value, comparison_result, message) = match threshold.metric.as_str() {
        "http_req_duration" | "duration" => {
            parse_duration_condition(condition, metrics)
        }
        "http_req_failed" | "error_rate" | "errors" => {
            parse_error_rate_condition(condition, metrics)
        }
        "iterations" => {
            let actual = metrics.iterations_completed as f64;
            let (passed, msg) = parse_numeric_condition(condition, actual);
            (actual, passed, msg)
        }
        "rps" | "requests_per_second" => {
            let actual = metrics.requests_per_second;
            let (passed, msg) = parse_numeric_condition(condition, actual);
            (actual, passed, msg)
        }
        _ => {
            (0.0, false, format!("Unknown metric: {}", threshold.metric))
        }
    };

    ThresholdResult {
        threshold: threshold.clone(),
        passed: comparison_result,
        actual_value,
        message,
    }
}

/// Parse duration-based conditions like "p(95)<500", "avg<200", "max<1000"
fn parse_duration_condition(condition: &str, metrics: &AggregatedMetrics) -> (f64, bool, String) {
    // Try to match percentile pattern: p(95)<500
    let percentile_re = Regex::new(r"p\((\d+)\)\s*([<>=!]+)\s*(\d+)").unwrap();
    if let Some(caps) = percentile_re.captures(condition) {
        let p: u32 = caps.get(1).unwrap().as_str().parse().unwrap_or(95);
        let op = caps.get(2).unwrap().as_str();
        let expected: f64 = caps.get(3).unwrap().as_str().parse().unwrap_or(0.0);

        let actual = match p {
            50 => metrics.duration_med as f64,
            90 => metrics.duration_p90 as f64,
            95 => metrics.duration_p95 as f64,
            99 => metrics.duration_p99 as f64,
            _ => metrics.duration_p95 as f64, // default to p95
        };

        let passed = compare_values(actual, op, expected);
        let message = format!("p({}) = {}ms {} {}ms", p, actual, op, expected);
        return (actual, passed, message);
    }

    // Try to match other patterns: avg<200, max<1000, min>10
    let simple_re = Regex::new(r"(avg|max|min|med)\s*([<>=!]+)\s*(\d+\.?\d*)").unwrap();
    if let Some(caps) = simple_re.captures(condition) {
        let metric_type = caps.get(1).unwrap().as_str();
        let op = caps.get(2).unwrap().as_str();
        let expected: f64 = caps.get(3).unwrap().as_str().parse().unwrap_or(0.0);

        let actual = match metric_type {
            "avg" => metrics.duration_avg,
            "max" => metrics.duration_max as f64,
            "min" => metrics.duration_min as f64,
            "med" => metrics.duration_med as f64,
            _ => metrics.duration_avg,
        };

        let passed = compare_values(actual, op, expected);
        let message = format!("{} = {}ms {} {}ms", metric_type, actual, op, expected);
        return (actual, passed, message);
    }

    // Default: try simple numeric comparison
    let (passed, message) = parse_numeric_condition(condition, metrics.duration_avg);
    (metrics.duration_avg, passed, message)
}

/// Parse error rate conditions like "rate<0.05", "<0.01"
fn parse_error_rate_condition(condition: &str, metrics: &AggregatedMetrics) -> (f64, bool, String) {
    let actual = metrics.error_rate;
    
    // Try to match: rate<0.05 or just <0.05
    let re = Regex::new(r"(?:rate)?\s*([<>=!]+)\s*(\d+\.?\d*)").unwrap();
    if let Some(caps) = re.captures(condition) {
        let op = caps.get(1).unwrap().as_str();
        let expected: f64 = caps.get(2).unwrap().as_str().parse().unwrap_or(0.0);

        let passed = compare_values(actual, op, expected);
        let message = format!("error_rate = {:.4} {} {}", actual, op, expected);
        return (actual, passed, message);
    }

    (actual, false, format!("Invalid condition: {}", condition))
}

/// Parse generic numeric conditions
fn parse_numeric_condition(condition: &str, actual: f64) -> (bool, String) {
    let re = Regex::new(r"([<>=!]+)\s*(\d+\.?\d*)").unwrap();
    if let Some(caps) = re.captures(condition) {
        let op = caps.get(1).unwrap().as_str();
        let expected: f64 = caps.get(2).unwrap().as_str().parse().unwrap_or(0.0);

        let passed = compare_values(actual, op, expected);
        let message = format!("{} {} {}", actual, op, expected);
        return (passed, message);
    }

    (false, format!("Invalid condition: {}", condition))
}

/// Compare two values based on operator
fn compare_values(actual: f64, op: &str, expected: f64) -> bool {
    match op {
        "<" => actual < expected,
        "<=" => actual <= expected,
        ">" => actual > expected,
        ">=" => actual >= expected,
        "==" | "=" => (actual - expected).abs() < f64::EPSILON,
        "!=" => (actual - expected).abs() >= f64::EPSILON,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_percentile() {
        let data = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        assert_eq!(percentile(&data, 50.0), 5);
        assert_eq!(percentile(&data, 90.0), 9);
        assert_eq!(percentile(&data, 95.0), 10);
    }

    #[test]
    fn test_compare_values() {
        assert!(compare_values(100.0, "<", 200.0));
        assert!(!compare_values(200.0, "<", 100.0));
        assert!(compare_values(0.01, "<", 0.05));
    }

    #[test]
    fn test_parse_duration_condition() {
        let metrics = AggregatedMetrics {
            duration_p95: 450,
            duration_avg: 200.0,
            ..Default::default()
        };

        let (actual, passed, _) = parse_duration_condition("p(95)<500", &metrics);
        assert_eq!(actual, 450.0);
        assert!(passed);

        let (actual, passed, _) = parse_duration_condition("avg<300", &metrics);
        assert_eq!(actual, 200.0);
        assert!(passed);
    }
}
