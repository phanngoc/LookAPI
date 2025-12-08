# Hướng dẫn sử dụng Performance Testing

## Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Kiến trúc](#2-kiến-trúc)
3. [Các loại Performance Test](#3-các-loại-performance-test)
4. [Cách tạo Performance Test](#4-cách-tạo-performance-test)
5. [Cấu hình Stages (Ramping)](#5-cấu-hình-stages-ramping)
6. [Thresholds](#6-thresholds)
7. [Chạy Performance Test](#7-chạy-performance-test)
8. [Đọc kết quả](#8-đọc-kết-quả)
9. [Real-time Monitoring](#9-real-time-monitoring)
10. [Best Practices](#10-best-practices)
11. [API Reference](#11-api-reference)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Giới thiệu

Performance Testing trong LookAPI cho phép bạn test hiệu năng của API bằng cách chạy **Test Scenario** với nhiều **Virtual Users (VUs)** đồng thời. Hệ thống lấy cảm hứng từ k6 nhưng được tích hợp trực tiếp vào LookAPI.

### Tại sao cần Performance Testing?

- **Xác định bottleneck**: Tìm ra endpoint nào chậm nhất
- **Đo baseline**: Biết được API chịu được bao nhiêu traffic
- **Phát hiện regression**: So sánh hiệu năng giữa các phiên bản
- **Capacity planning**: Lên kế hoạch scale hệ thống

### Flow cơ bản

```
Test Scenario (đã có) → Performance Test Config → Run Test → Metrics & Results
```

---

## 2. Kiến trúc

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Config Editor   │  │ Progress View   │  │ Results View │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘ │
│           │                    │                   │         │
│           ▼                    ▼                   ▼         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              usePerformanceTest Hook                    ││
│  │         (Real-time events via Tauri)                    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Rust)                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ PerformanceExec │  │ StageScheduler  │  │ MetricsCollec│ │
│  │     utor        │  │                 │  │     tor      │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘ │
│           │                    │                   │         │
│           ▼                    ▼                   ▼         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  Virtual Users (VUs)                    ││
│  │    VU-0    VU-1    VU-2    ...    VU-N                  ││
│  │      │       │       │              │                   ││
│  │      └───────┴───────┴──────────────┘                   ││
│  │                      │                                   ││
│  │                      ▼                                   ││
│  │             Test Scenario Steps                          ││
│  │         (Login → Browse → Cart → Checkout)              ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Config**: Tạo PerformanceTestConfig liên kết với TestScenario
2. **Run**: Executor spawn nhiều VUs, mỗi VU chạy scenario loop
3. **Collect**: MetricsCollector thu thập response times, errors
4. **Emit**: Real-time events gửi về frontend
5. **Aggregate**: Tính toán percentiles, throughput, error rate
6. **Evaluate**: So sánh với thresholds để pass/fail

---

## 3. Các loại Performance Test

### 3.1 Smoke Test

**Mục đích**: Sanity check nhanh, đảm bảo scenario hoạt động

```typescript
{
  testType: 'smoke',
  vus: 2,
  durationSecs: 30,
  thresholds: [
    { metric: 'http_req_duration', condition: 'p(95)<500' },
    { metric: 'error_rate', condition: 'rate<0.05' }
  ]
}
```

**Khi nào dùng**:
- Sau khi tạo scenario mới
- Trong CI/CD pipeline
- Trước khi chạy test nặng hơn

### 3.2 Load Test

**Mục đích**: Test với traffic bình thường, đo baseline performance

```typescript
{
  testType: 'load',
  stages: [
    { durationSecs: 120, targetVus: 50 },   // Ramp up 2 phút
    { durationSecs: 600, targetVus: 50 },   // Sustain 10 phút
    { durationSecs: 120, targetVus: 0 }     // Ramp down 2 phút
  ],
  thresholds: [
    { metric: 'http_req_duration', condition: 'p(95)<800' },
    { metric: 'error_rate', condition: 'rate<0.01' }
  ]
}
```

**Khi nào dùng**:
- Đo baseline performance
- Before/after so sánh khi refactor
- Regular performance monitoring

### 3.3 Stress Test

**Mục đích**: Tìm breaking point của hệ thống

```typescript
{
  testType: 'stress',
  stages: [
    { durationSecs: 120, targetVus: 50 },
    { durationSecs: 120, targetVus: 100 },
    { durationSecs: 120, targetVus: 150 },
    { durationSecs: 120, targetVus: 200 },
    { durationSecs: 120, targetVus: 0 }
  ],
  thresholds: [
    { metric: 'http_req_duration', condition: 'p(95)<1500' },
    { metric: 'error_rate', condition: 'rate<0.05' }
  ]
}
```

**Khi nào dùng**:
- Capacity planning
- Tìm giới hạn của hệ thống
- Kiểm tra auto-scaling

### 3.4 Spike Test

**Mục đích**: Kiểm tra hệ thống khi traffic tăng đột ngột

```typescript
{
  testType: 'spike',
  stages: [
    { durationSecs: 10, targetVus: 10 },    // Warm up
    { durationSecs: 10, targetVus: 500 },   // Spike!
    { durationSecs: 30, targetVus: 500 },   // Hold
    { durationSecs: 60, targetVus: 10 }     // Recover
  ],
  thresholds: [
    { metric: 'http_req_duration', condition: 'p(95)<2000' },
    { metric: 'error_rate', condition: 'rate<0.2' }
  ]
}
```

**Khi nào dùng**:
- Chuẩn bị cho flash sale
- Test rate limiting
- Kiểm tra graceful degradation

### 3.5 Soak Test

**Mục đích**: Tìm memory leak, connection leak qua thời gian dài

```typescript
{
  testType: 'soak',
  stages: [
    { durationSecs: 300, targetVus: 50 },      // Ramp up 5 phút
    { durationSecs: 14400, targetVus: 50 },    // Sustain 4 giờ
    { durationSecs: 300, targetVus: 0 }        // Ramp down 5 phút
  ],
  thresholds: [
    { metric: 'http_req_duration', condition: 'p(95)<1000' },
    { metric: 'error_rate', condition: 'rate<0.01' }
  ]
}
```

**Khi nào dùng**:
- Phát hiện memory leak
- Long-running stability test
- Before major release

---

## 4. Cách tạo Performance Test

### Bước 1: Tạo Test Scenario

Trước tiên, bạn cần có một Test Scenario đã hoạt động:

```typescript
// Scenario với các steps
const scenario = {
  name: 'E-commerce Flow',
  steps: [
    { name: 'Login', type: 'request', config: { url: '/auth/login', method: 'POST', ... } },
    { name: 'Get Products', type: 'request', config: { url: '/products', method: 'GET', ... } },
    { name: 'Add to Cart', type: 'request', config: { url: '/cart/items', method: 'POST', ... } },
    { name: 'Checkout', type: 'request', config: { url: '/orders/checkout', method: 'POST', ... } },
  ]
};
```

### Bước 2: Tạo Performance Test Config

```typescript
import { tauriService } from '@/services/tauri';
import { createLoadTestConfig } from '@/types/performance';

// Dùng helper function
const input = createLoadTestConfig(
  scenarioId,
  'Load Test - 50 VUs',
  50,   // target VUs
  10    // sustain minutes
);

// Hoặc tạo thủ công
const input = {
  scenarioId: 'your-scenario-id',
  name: 'Custom Load Test',
  testType: 'load',
  stages: [
    { durationSecs: 60, targetVus: 25 },
    { durationSecs: 300, targetVus: 50 },
    { durationSecs: 60, targetVus: 0 },
  ],
  thresholds: [
    { metric: 'http_req_duration', condition: 'p(95)<500' },
    { metric: 'error_rate', condition: 'rate<0.01' },
  ],
};

const config = await tauriService.createPerformanceTest(input);
```

### Bước 3: Sử dụng React Hook

```tsx
import { useScenarioPerformanceTest } from '@/hooks/usePerformanceTest';

function PerformanceTestPanel({ scenarioId }: { scenarioId: string }) {
  const {
    configs,
    isLoadingConfigs,
    createConfig,
    deleteConfig,
    runTest,
    isRunning,
    progress,
    completedRun,
  } = useScenarioPerformanceTest(scenarioId);

  const handleCreateTest = async () => {
    await createConfig({
      scenarioId,
      name: 'My Load Test',
      testType: 'load',
      vus: 50,
      durationSecs: 300,
      thresholds: [
        { metric: 'http_req_duration', condition: 'p(95)<800' },
      ],
    });
  };

  const handleRunTest = async (configId: string) => {
    await runTest(configId);
  };

  return (
    <div>
      {/* UI components */}
    </div>
  );
}
```

---

## 5. Cấu hình Stages (Ramping)

### Cách Stages hoạt động

Stages cho phép tăng/giảm số VUs theo thời gian:

```
VUs
│
│     ┌──────────────────┐
│    ╱                    ╲
│   ╱                      ╲
│  ╱                        ╲
│ ╱                          ╲
│╱                            ╲
└────────────────────────────────────────────► Time
  Stage 1    Stage 2     Stage 3
  (ramp up)  (sustain)  (ramp down)
```

### Linear Interpolation

Trong mỗi stage, VUs được tăng/giảm **tuyến tính**:

```typescript
stages: [
  { durationSecs: 60, targetVus: 50 },  // 0→50 VUs trong 60s
  { durationSecs: 300, targetVus: 50 }, // Giữ 50 VUs trong 300s
  { durationSecs: 60, targetVus: 0 },   // 50→0 VUs trong 60s
]
```

Tại `t=30s`: VUs = 25 (nửa đường ramp up)
Tại `t=60s`: VUs = 50
Tại `t=360s`: VUs = 50
Tại `t=390s`: VUs = 25 (nửa đường ramp down)

### Ví dụ các patterns

**Gradual Ramp**:
```typescript
stages: [
  { durationSecs: 60, targetVus: 10 },
  { durationSecs: 60, targetVus: 20 },
  { durationSecs: 60, targetVus: 30 },
  { durationSecs: 60, targetVus: 40 },
  { durationSecs: 60, targetVus: 50 },
  { durationSecs: 300, targetVus: 50 },
  { durationSecs: 60, targetVus: 0 },
]
```

**Step Function**:
```typescript
stages: [
  { durationSecs: 1, targetVus: 50 },   // Jump to 50
  { durationSecs: 300, targetVus: 50 }, // Hold
  { durationSecs: 1, targetVus: 0 },    // Drop to 0
]
```

---

## 6. Thresholds

### Supported Metrics

| Metric | Mô tả | Ví dụ |
|--------|-------|-------|
| `http_req_duration` | Response time | `p(95)<500`, `avg<200` |
| `error_rate` | Tỷ lệ lỗi | `rate<0.05` |
| `http_req_failed` | Alias cho error_rate | `<0.01` |
| `rps` | Requests per second | `>100` |
| `iterations` | Số iterations hoàn thành | `>1000` |

### Condition Syntax

**Percentile**:
```typescript
{ metric: 'http_req_duration', condition: 'p(95)<500' }   // p95 < 500ms
{ metric: 'http_req_duration', condition: 'p(99)<1000' }  // p99 < 1000ms
{ metric: 'http_req_duration', condition: 'p(50)<200' }   // median < 200ms
```

**Aggregates**:
```typescript
{ metric: 'http_req_duration', condition: 'avg<300' }     // average < 300ms
{ metric: 'http_req_duration', condition: 'max<2000' }    // max < 2000ms
{ metric: 'http_req_duration', condition: 'min>0' }       // min > 0ms
```

**Error Rate**:
```typescript
{ metric: 'error_rate', condition: 'rate<0.05' }  // < 5% errors
{ metric: 'error_rate', condition: '<0.01' }      // < 1% errors
```

### Threshold Evaluation

Test **PASSED** khi tất cả thresholds đều pass:

```typescript
// Result example
thresholdResults: [
  {
    threshold: { metric: 'http_req_duration', condition: 'p(95)<500' },
    passed: true,
    actualValue: 342,
    message: 'p(95) = 342ms < 500ms'
  },
  {
    threshold: { metric: 'error_rate', condition: 'rate<0.05' },
    passed: true,
    actualValue: 0.008,
    message: 'error_rate = 0.0080 < 0.05'
  }
]
```

---

## 7. Chạy Performance Test

### Từ Code

```typescript
import { tauriService } from '@/services/tauri';

// Chạy test
const run = await tauriService.runPerformanceTest(configId);

console.log('Status:', run.status);           // 'passed' | 'failed'
console.log('Total requests:', run.metrics?.totalRequests);
console.log('P95 duration:', run.metrics?.durationP95);
console.log('Error rate:', run.metrics?.errorRate);
```

### Từ React Component

```tsx
import { usePerformanceProgress, usePerformanceTestRuns } from '@/hooks/usePerformanceTest';

function RunButton({ configId }: { configId: string }) {
  const { runTest, isRunning, runs } = usePerformanceTestRuns(configId);
  const { progress, completedRun } = usePerformanceProgress();

  return (
    <div>
      <button 
        onClick={() => runTest()} 
        disabled={isRunning}
      >
        {isRunning ? `Running... ${progress.totalRequests} requests` : 'Run Test'}
      </button>
      
      {completedRun && (
        <div>
          Status: {completedRun.status}
          Requests: {completedRun.metrics?.totalRequests}
        </div>
      )}
    </div>
  );
}
```

---

## 8. Đọc kết quả

### PerformanceTestRun Structure

```typescript
interface PerformanceTestRun {
  id: string;
  configId: string;
  scenarioId: string;
  status: 'passed' | 'failed' | 'stopped' | 'error';
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  maxVusReached: number;
  metrics?: AggregatedMetrics;
  thresholdResults: ThresholdResult[];
  errorMessage?: string;
}
```

### AggregatedMetrics

```typescript
interface AggregatedMetrics {
  totalRequests: number;      // Tổng số requests
  failedRequests: number;     // Số requests fail
  errorRate: number;          // Tỷ lệ lỗi (0-1)
  
  // Response time (ms)
  durationMin: number;
  durationMax: number;
  durationAvg: number;
  durationMed: number;        // Median (p50)
  durationP90: number;
  durationP95: number;
  durationP99: number;
  
  // Throughput
  requestsPerSecond: number;
  iterationsCompleted: number;
  totalDurationMs: number;
  
  // Per-step breakdown
  stepMetrics: Record<string, StepMetrics>;
}
```

### Ví dụ đọc kết quả

```typescript
const run = await tauriService.getPerformanceTestRun(runId);

if (run?.status === 'passed') {
  console.log('✅ Test PASSED');
} else {
  console.log('❌ Test FAILED');
  
  // Tìm threshold nào fail
  run?.thresholdResults.forEach(result => {
    if (!result.passed) {
      console.log(`  - ${result.message}`);
    }
  });
}

// In metrics
const m = run?.metrics;
if (m) {
  console.log(`
Total Requests: ${m.totalRequests}
Error Rate: ${(m.errorRate * 100).toFixed(2)}%
RPS: ${m.requestsPerSecond.toFixed(2)}

Response Times:
  Min: ${m.durationMin}ms
  Avg: ${m.durationAvg.toFixed(2)}ms
  Med: ${m.durationMed}ms
  P90: ${m.durationP90}ms
  P95: ${m.durationP95}ms
  P99: ${m.durationP99}ms
  Max: ${m.durationMax}ms
  `);
}
```

---

## 9. Real-time Monitoring

### Events

Hệ thống emit các events để theo dõi real-time:

| Event | Khi nào | Payload |
|-------|---------|---------|
| `perf-started` | Test bắt đầu | `{ runId, configId, scenarioId }` |
| `perf-progress` | Mỗi 1 giây | `{ elapsedSecs, currentVus, totalRequests, rps, errorRate, p95Duration }` |
| `perf-stage-changed` | Chuyển stage | `{ stageIndex, targetVus, durationSecs }` |
| `perf-request-completed` | Mỗi request | `{ vuId, stepName, durationMs, success, status }` |
| `perf-completed` | Test xong | `{ runId, run: PerformanceTestRun }` |

### Listen Events

```typescript
import { listen } from '@tauri-apps/api/event';
import { PerfProgressEvent } from '@/types/performance';

// Listen progress
const unlisten = await listen<PerfProgressEvent>('perf-progress', (event) => {
  console.log(`
Elapsed: ${event.payload.elapsedSecs}s
VUs: ${event.payload.currentVus}
Requests: ${event.payload.totalRequests}
RPS: ${event.payload.rps.toFixed(2)}
Error Rate: ${(event.payload.errorRate * 100).toFixed(2)}%
P95: ${event.payload.p95Duration}ms
  `);
});

// Cleanup
unlisten();
```

### Hook-based Monitoring

```tsx
import { usePerformanceProgress } from '@/hooks/usePerformanceTest';

function ProgressView() {
  const { progress } = usePerformanceProgress();

  if (!progress.isRunning) {
    return <div>Not running</div>;
  }

  return (
    <div>
      <div>Elapsed: {progress.elapsedSecs}s</div>
      <div>VUs: {progress.currentVus}</div>
      <div>Requests: {progress.totalRequests}</div>
      <div>RPS: {progress.rps.toFixed(2)}</div>
      <div>Error Rate: {(progress.errorRate * 100).toFixed(2)}%</div>
      <div>P95: {progress.p95Duration}ms</div>
      
      {progress.currentStage && (
        <div>
          Stage {progress.currentStage.index + 1}: 
          Target {progress.currentStage.targetVus} VUs
        </div>
      )}
    </div>
  );
}
```

---

## 10. Best Practices

### 1. Luôn bắt đầu với Smoke Test

```typescript
// Chạy smoke test trước để đảm bảo scenario hoạt động
const smokeConfig = createSmokeTestConfig(scenarioId, 'Smoke Test');
await tauriService.createPerformanceTest(smokeConfig);
```

### 2. Sử dụng Ramping

```typescript
// ❌ Không nên: Jump từ 0 lên 100 VUs
{ vus: 100, durationSecs: 300 }

// ✅ Nên: Ramp up từ từ
stages: [
  { durationSecs: 60, targetVus: 100 },  // Ramp up
  { durationSecs: 300, targetVus: 100 }, // Sustain
  { durationSecs: 60, targetVus: 0 },    // Ramp down
]
```

### 3. Đặt Thresholds Hợp Lý

```typescript
// Smoke test: Thoáng hơn
thresholds: [
  { metric: 'http_req_duration', condition: 'p(95)<500' },
  { metric: 'error_rate', condition: 'rate<0.05' },  // 5%
]

// Load test: Chặt hơn
thresholds: [
  { metric: 'http_req_duration', condition: 'p(95)<800' },
  { metric: 'error_rate', condition: 'rate<0.01' },  // 1%
]

// Stress test: Cho phép cao hơn
thresholds: [
  { metric: 'http_req_duration', condition: 'p(95)<2000' },
  { metric: 'error_rate', condition: 'rate<0.1' },   // 10%
]
```

### 4. Test với Realistic Data

- Sử dụng CSV data để tạo đa dạng test cases
- Không dùng cùng credentials cho tất cả VUs
- Mô phỏng think time giữa các steps

### 5. Monitor Backend

- Kết hợp với monitoring (CPU, Memory, DB)
- Theo dõi logs trong quá trình test
- Check database connections, queue size

### 6. Lưu và So sánh Results

```typescript
// Lấy tất cả runs để so sánh
const runs = await tauriService.getPerformanceTestRuns(configId);

// So sánh P95 giữa các lần chạy
runs.forEach(run => {
  console.log(`${run.startedAt}: P95=${run.metrics?.durationP95}ms`);
});
```

---

## 11. API Reference

### Tauri Service

```typescript
// Create config
tauriService.createPerformanceTest(input: CreatePerformanceTestInput): Promise<PerformanceTestConfig>

// Get configs
tauriService.getPerformanceTests(scenarioId: string): Promise<PerformanceTestConfig[]>
tauriService.getPerformanceTest(configId: string): Promise<PerformanceTestConfig | null>

// Update config
tauriService.updatePerformanceTest(
  configId: string,
  name?: string,
  testType?: string,
  vus?: number,
  durationSecs?: number,
  iterations?: number,
  stages?: Stage[],
  thresholds?: Threshold[]
): Promise<PerformanceTestConfig>

// Delete config
tauriService.deletePerformanceTest(configId: string): Promise<void>

// Run test
tauriService.runPerformanceTest(configId: string): Promise<PerformanceTestRun>

// Get runs
tauriService.getPerformanceTestRuns(configId: string): Promise<PerformanceTestRun[]>
tauriService.getPerformanceTestRun(runId: string): Promise<PerformanceTestRun | null>
```

### React Hooks

```typescript
// Config management
usePerformanceTests(scenarioId: string)
usePerformanceTest(configId: string)

// Runs
usePerformanceTestRuns(configId: string)

// Real-time progress
usePerformanceProgress()

// Combined
useScenarioPerformanceTest(scenarioId: string)
```

### Helper Functions

```typescript
// Create default configs
createSmokeTestConfig(scenarioId, name)
createLoadTestConfig(scenarioId, name, targetVus, sustainMinutes)
createStressTestConfig(scenarioId, name, maxVus)
createSpikeTestConfig(scenarioId, name, baseVus, spikeVus)
createSoakTestConfig(scenarioId, name, vus, hours)

// Formatting
formatDuration(ms: number): string
formatErrorRate(rate: number): string
getStatusColor(status: PerformanceRunStatus): string
getTestTypeDescription(type: PerformanceTestType): string
```

---

## 12. Troubleshooting

### Test không chạy được

1. **Kiểm tra scenario có hoạt động**:
   - Chạy scenario bình thường trước (functional test)
   - Đảm bảo base URL đúng

2. **Kiểm tra database**:
   - Scenario tồn tại
   - Steps enabled

### VUs không tăng như mong đợi

1. **Kiểm tra stages config**:
   ```typescript
   // Đảm bảo stages được định nghĩa đúng
   stages: [
     { durationSecs: 60, targetVus: 50 },  // Phải có duration > 0
   ]
   ```

2. **Kiểm tra iterations limit**:
   ```typescript
   // Nếu set iterations, test sẽ dừng khi đạt limit
   iterations: 1000  // Test dừng sau 1000 iterations
   ```

### Error rate cao bất thường

1. **Kiểm tra target server**:
   - Server có đang chạy?
   - Rate limiting có enabled?
   - Connection pool có đủ?

2. **Kiểm tra timeout**:
   - Default timeout là 30s
   - Slow endpoint có thể timeout

### Metrics không chính xác

1. **Warm up period**:
   - Metrics trong giai đoạn đầu có thể không stable
   - Dùng ramp up stage để warm up

2. **Sample size**:
   - Test quá ngắn sẽ có ít sample
   - Cần đủ requests để percentiles chính xác

### Memory issues với test dài

1. **Soak test**:
   - Monitor memory usage của LookAPI
   - Có thể cần restart sau test dài

---

## Changelog

- **v1.0.0**: Initial release
  - Basic performance testing
  - 5 test types: smoke, load, stress, spike, soak
  - Ramping stages
  - Thresholds evaluation
  - Real-time progress events
