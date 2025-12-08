/**
 * Performance Testing Types
 * 
 * TypeScript types for the performance testing module.
 * These types mirror the Rust types in scenario/performance/types.rs
 */

/** Performance test type (inspired by k6) */
export type PerformanceTestType = 'smoke' | 'load' | 'stress' | 'spike' | 'soak';

/** Stage configuration for ramping VUs */
export interface Stage {
  durationSecs: number;    // Duration of this stage in seconds
  targetVus: number;       // Target VUs at the end of this stage
}

/** Threshold definition for pass/fail criteria */
export interface Threshold {
  metric: string;          // 'http_req_duration', 'http_req_failed', etc.
  condition: string;       // 'p(95)<500', 'rate<0.05'
}

/** Threshold evaluation result */
export interface ThresholdResult {
  threshold: Threshold;
  passed: boolean;
  actualValue: number;
  message: string;
}

/** Performance Test Configuration */
export interface PerformanceTestConfig {
  id: string;
  scenarioId: string;
  name: string;
  testType: PerformanceTestType;
  vus?: number;                    // Fixed VUs (if not using stages)
  durationSecs?: number;           // Fixed duration in seconds
  iterations?: number;             // Or number of iterations
  stages?: Stage[];                // Ramping stages
  thresholds: Threshold[];
  createdAt: number;
  updatedAt: number;
}

/** Input for creating a performance test config */
export interface CreatePerformanceTestInput {
  scenarioId: string;
  name: string;
  testType: string;
  vus?: number;
  durationSecs?: number;
  iterations?: number;
  stages?: Stage[];
  thresholds?: Threshold[];
}

/** Metrics for a single HTTP request */
export interface RequestMetric {
  stepId: string;
  stepName: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  success: boolean;
  vuId: number;
  iteration: number;
  timestamp: number;
}

/** Per-step aggregated metrics */
export interface StepMetrics {
  stepName: string;
  totalRequests: number;
  failedRequests: number;
  errorRate: number;
  durationMin: number;
  durationMax: number;
  durationAvg: number;
  durationMed: number;      // p50
  durationP90: number;
  durationP95: number;
  durationP99: number;
}

/** Aggregated metrics for the entire performance test */
export interface AggregatedMetrics {
  totalRequests: number;
  failedRequests: number;
  errorRate: number;
  
  // Response time percentiles (in ms)
  durationMin: number;
  durationMax: number;
  durationAvg: number;
  durationMed: number;      // p50
  durationP90: number;
  durationP95: number;
  durationP99: number;
  
  // Throughput
  requestsPerSecond: number;
  iterationsCompleted: number;
  
  // Duration
  totalDurationMs: number;
  
  // Per-step metrics
  stepMetrics: Record<string, StepMetrics>;
}

/** Performance run status */
export type PerformanceRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'stopped' | 'error';

/** Performance Test Run Result */
export interface PerformanceTestRun {
  id: string;
  configId: string;
  scenarioId: string;
  status: PerformanceRunStatus;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  maxVusReached: number;
  metrics?: AggregatedMetrics;
  thresholdResults: ThresholdResult[];
  errorMessage?: string;
}

// ============================================================================
// Event payloads for real-time progress updates
// ============================================================================

/** Event emitted when performance test starts */
export interface PerfStartedEvent {
  runId: string;
  configId: string;
  scenarioId: string;
  startedAt: number;
}

/** Event emitted when a single request completes */
export interface PerfRequestCompletedEvent {
  runId: string;
  vuId: number;
  stepName: string;
  durationMs: number;
  success: boolean;
  status: number;
}

/** Event emitted periodically with progress metrics */
export interface PerfProgressEvent {
  runId: string;
  elapsedSecs: number;
  currentVus: number;
  totalRequests: number;
  failedRequests: number;
  rps: number;                    // Requests per second
  errorRate: number;
  p95Duration: number;
  iterationsCompleted: number;
}

/** Event emitted when stage changes */
export interface PerfStageChangedEvent {
  runId: string;
  stageIndex: number;
  targetVus: number;
  durationSecs: number;
}

/** Event emitted when performance test completes */
export interface PerfCompletedEvent {
  runId: string;
  run: PerformanceTestRun;
}

// ============================================================================
// Helper functions for creating default configurations
// ============================================================================

/** Create default smoke test config */
export function createSmokeTestConfig(scenarioId: string, name: string): CreatePerformanceTestInput {
  return {
    scenarioId,
    name: name || 'Smoke Test',
    testType: 'smoke',
    vus: 2,
    durationSecs: 30,
    thresholds: [
      { metric: 'http_req_duration', condition: 'p(95)<500' },
      { metric: 'error_rate', condition: 'rate<0.05' },
    ],
  };
}

/** Create default load test config */
export function createLoadTestConfig(
  scenarioId: string, 
  name: string,
  targetVus: number = 50,
  sustainMinutes: number = 10
): CreatePerformanceTestInput {
  return {
    scenarioId,
    name: name || 'Load Test',
    testType: 'load',
    stages: [
      { durationSecs: 120, targetVus },              // Ramp up 2 min
      { durationSecs: sustainMinutes * 60, targetVus }, // Sustain
      { durationSecs: 120, targetVus: 0 },           // Ramp down 2 min
    ],
    thresholds: [
      { metric: 'http_req_duration', condition: 'p(95)<800' },
      { metric: 'error_rate', condition: 'rate<0.01' },
    ],
  };
}

/** Create default stress test config */
export function createStressTestConfig(
  scenarioId: string, 
  name: string,
  maxVus: number = 200
): CreatePerformanceTestInput {
  return {
    scenarioId,
    name: name || 'Stress Test',
    testType: 'stress',
    stages: [
      { durationSecs: 120, targetVus: Math.floor(maxVus / 4) },
      { durationSecs: 120, targetVus: Math.floor(maxVus / 2) },
      { durationSecs: 120, targetVus: Math.floor(maxVus * 3 / 4) },
      { durationSecs: 120, targetVus: maxVus },
      { durationSecs: 120, targetVus: 0 },
    ],
    thresholds: [
      { metric: 'http_req_duration', condition: 'p(95)<1500' },
      { metric: 'error_rate', condition: 'rate<0.05' },
    ],
  };
}

/** Create default spike test config */
export function createSpikeTestConfig(
  scenarioId: string, 
  name: string,
  baseVus: number = 10,
  spikeVus: number = 500
): CreatePerformanceTestInput {
  return {
    scenarioId,
    name: name || 'Spike Test',
    testType: 'spike',
    stages: [
      { durationSecs: 10, targetVus: baseVus },    // Warm up
      { durationSecs: 10, targetVus: spikeVus },   // Spike up
      { durationSecs: 30, targetVus: spikeVus },   // Hold spike
      { durationSecs: 60, targetVus: baseVus },    // Recover
    ],
    thresholds: [
      { metric: 'http_req_duration', condition: 'p(95)<2000' },
      { metric: 'error_rate', condition: 'rate<0.2' },
    ],
  };
}

/** Create default soak test config */
export function createSoakTestConfig(
  scenarioId: string, 
  name: string,
  vus: number = 50,
  hours: number = 4
): CreatePerformanceTestInput {
  return {
    scenarioId,
    name: name || 'Soak Test',
    testType: 'soak',
    stages: [
      { durationSecs: 300, targetVus: vus },           // Ramp up 5 min
      { durationSecs: hours * 3600, targetVus: vus },  // Sustain
      { durationSecs: 300, targetVus: 0 },             // Ramp down 5 min
    ],
    thresholds: [
      { metric: 'http_req_duration', condition: 'p(95)<1000' },
      { metric: 'error_rate', condition: 'rate<0.01' },
    ],
  };
}

// ============================================================================
// Utility functions
// ============================================================================

/** Format duration in ms to human readable string */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/** Format error rate to percentage string */
export function formatErrorRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

/** Get status color for UI */
export function getStatusColor(status: PerformanceRunStatus): string {
  switch (status) {
    case 'passed': return 'text-green-600';
    case 'failed': return 'text-red-600';
    case 'running': return 'text-blue-600';
    case 'stopped': return 'text-yellow-600';
    case 'error': return 'text-red-600';
    case 'pending': return 'text-gray-600';
    default: return 'text-gray-600';
  }
}

/** Get test type description */
export function getTestTypeDescription(type: PerformanceTestType): string {
  switch (type) {
    case 'smoke': return 'Quick sanity check with few VUs';
    case 'load': return 'Baseline test with typical load';
    case 'stress': return 'Find breaking point with high load';
    case 'spike': return 'Test sudden traffic spikes';
    case 'soak': return 'Long-duration test for memory leaks';
    default: return '';
  }
}
