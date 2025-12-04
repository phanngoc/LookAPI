# Plan: Tính năng Test Scenario

## 📋 Tổng quan

Test Scenario là một tính năng nâng cao cho phép tạo và chạy các kịch bản test phức tạp với nhiều requests được kết nối với nhau, hỗ trợ truyền dữ liệu giữa các requests, assertions, và logic điều khiển luồng.

### So sánh với Test Suite hiện tại

| Tính năng | Test Suite (hiện tại) | Test Scenario (mới) |
|-----------|----------------------|---------------------|
| Cấu trúc | Danh sách endpoint IDs đơn giản | Các test steps với cấu hình chi tiết |
| Thứ tự thực thi | Tuần tự theo danh sách | Tuần tự với khả năng điều khiển luồng |
| Truyền dữ liệu | Không | Có (extract từ response, inject vào request tiếp theo) |
| Assertions | Không | Có (validate response status, body, headers) |
| Logic điều khiển | Không | Có (if/else, loop, conditions) |
| Variables | Không | Có (global, environment, local) |
| Test data | Không | Có (predefined data sets) |
| Pre/Post scripts | Không | Có (setup/teardown) |
| Báo cáo | Cơ bản | Chi tiết với assertions và metrics |

## 🎯 Mục tiêu

1. **Sequential Request Execution**: Chạy nhiều requests theo thứ tự với khả năng truyền dữ liệu
2. **Assertions & Validations**: Kiểm tra response status, body, headers
3. **Data Extraction & Injection**: Trích xuất dữ liệu từ response và sử dụng trong request tiếp theo
4. **Variables Management**: Quản lý biến global, environment, và local
5. **Test Reporting**: Báo cáo chi tiết với pass/fail cho từng step và tổng thể
6. **Conditional Logic**: Hỗ trợ if/else, loops (for, foreach) để điều khiển luồng
7. **Pre/Post Scripts**: Scripts chạy trước và sau scenario

## 🏗️ Kiến trúc và Thiết kế

### 1. Database Schema

#### Bảng `test_scenarios`
```sql
CREATE TABLE IF NOT EXISTS test_scenarios (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
    variables TEXT DEFAULT '{}', -- JSON: global variables
    pre_script TEXT, -- JavaScript code chạy trước scenario
    post_script TEXT, -- JavaScript code chạy sau scenario
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

#### Bảng `test_scenario_steps`
```sql
CREATE TABLE IF NOT EXISTS test_scenario_steps (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    step_order INTEGER NOT NULL, -- Thứ tự thực thi
    step_type TEXT NOT NULL, -- 'request', 'condition', 'loop', 'delay', 'script'
    name TEXT NOT NULL,
    config TEXT NOT NULL, -- JSON: cấu hình chi tiết của step
    enabled BOOLEAN DEFAULT 1,
    FOREIGN KEY (scenario_id) REFERENCES test_scenarios(id) ON DELETE CASCADE
);
```

#### Bảng `test_scenario_runs`
```sql
CREATE TABLE IF NOT EXISTS test_scenario_runs (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    status TEXT NOT NULL, -- 'pending', 'running', 'passed', 'failed', 'stopped'
    total_steps INTEGER NOT NULL,
    passed_steps INTEGER NOT NULL DEFAULT 0,
    failed_steps INTEGER NOT NULL DEFAULT 0,
    skipped_steps INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER,
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    error_message TEXT,
    results TEXT NOT NULL DEFAULT '[]', -- JSON: kết quả chi tiết từng step
    FOREIGN KEY (scenario_id) REFERENCES test_scenarios(id) ON DELETE CASCADE
);
```

### 2. Data Types (Rust)

#### `src-tauri/src/types.rs`
```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestScenario {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub priority: String, // "low", "medium", "high"
    pub variables: serde_json::Value, // Global variables
    #[serde(rename = "preScript")]
    pub pre_script: Option<String>,
    #[serde(rename = "postScript")]
    pub post_script: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum TestStepType {
    Request,
    Condition,
    Loop,
    Delay,
    Script,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestScenarioStep {
    pub id: String,
    #[serde(rename = "scenarioId")]
    pub scenario_id: String,
    #[serde(rename = "stepOrder")]
    pub step_order: i32,
    #[serde(rename = "stepType")]
    pub step_type: TestStepType,
    pub name: String,
    pub config: serde_json::Value, // Step-specific configuration
    pub enabled: bool,
}

// Request Step Config
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequestStepConfig {
    #[serde(rename = "endpointId")]
    pub endpoint_id: Option<String>, // Link to endpoint spec
    pub url: String,
    pub method: String,
    pub headers: Option<HashMap<String, String>>,
    pub params: Option<serde_json::Value>,
    #[serde(rename = "extractVariables")]
    pub extract_variables: Option<Vec<VariableExtractor>>, // Extract data from response
    pub assertions: Option<Vec<Assertion>>,
}

// Condition Step Config
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConditionStepConfig {
    pub condition: String, // JavaScript expression
    #[serde(rename = "trueSteps")]
    pub true_steps: Vec<String>, // Step IDs to execute if true
    #[serde(rename = "falseSteps")]
    pub false_steps: Vec<String>, // Step IDs to execute if false
}

// Loop Step Config
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoopStepConfig {
    #[serde(rename = "loopType")]
    pub loop_type: String, // "for", "foreach", "while"
    pub iterator: String, // Variable name or expression
    pub steps: Vec<String>, // Step IDs to loop
}

// Delay Step Config
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DelayStepConfig {
    pub duration_ms: u64,
}

// Script Step Config
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScriptStepConfig {
    pub code: String, // JavaScript code
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VariableExtractor {
    pub name: String, // Variable name
    pub source: String, // "body", "header", "status"
    pub path: String, // JSONPath, XPath, hoặc regex
    #[serde(rename = "defaultValue")]
    pub default_value: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Assertion {
    pub name: String,
    pub source: String, // "status", "body", "header", "duration"
    pub operator: String, // "equals", "contains", "matches", "greaterThan", "lessThan", etc.
    pub expected: serde_json::Value,
    pub actual: Option<serde_json::Value>, // Filled during execution
    pub passed: Option<bool>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestScenarioRun {
    pub id: String,
    #[serde(rename = "scenarioId")]
    pub scenario_id: String,
    pub status: String, // "pending", "running", "passed", "failed", "stopped"
    #[serde(rename = "totalSteps")]
    pub total_steps: u32,
    #[serde(rename = "passedSteps")]
    pub passed_steps: u32,
    #[serde(rename = "failedSteps")]
    pub failed_steps: u32,
    #[serde(rename = "skippedSteps")]
    pub skipped_steps: u32,
    #[serde(rename = "durationMs")]
    pub duration_ms: Option<u64>,
    #[serde(rename = "startedAt")]
    pub started_at: i64,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<i64>,
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
    pub results: Vec<TestStepResult>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestStepResult {
    #[serde(rename = "stepId")]
    pub step_id: String,
    pub name: String,
    pub status: String, // "pending", "running", "passed", "failed", "skipped"
    pub duration_ms: Option<u64>,
    pub response: Option<ApiResponse>,
    pub assertions: Option<Vec<Assertion>>,
    pub error: Option<String>,
    #[serde(rename = "extractedVariables")]
    pub extracted_variables: Option<HashMap<String, serde_json::Value>>,
}
```

### 3. Data Types (TypeScript)

#### `src/types/scenario.ts`
```typescript
export interface TestScenario {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  variables: Record<string, any>;
  preScript?: string;
  postScript?: string;
  createdAt: number;
  updatedAt: number;
}

export type TestStepType = 'request' | 'condition' | 'loop' | 'delay' | 'script';

export interface TestScenarioStep {
  id: string;
  scenarioId: string;
  stepOrder: number;
  stepType: TestStepType;
  name: string;
  config: RequestStepConfig | ConditionStepConfig | LoopStepConfig | DelayStepConfig | ScriptStepConfig;
  enabled: boolean;
}

export interface RequestStepConfig {
  endpointId?: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  extractVariables?: VariableExtractor[];
  assertions?: Assertion[];
}

export interface ConditionStepConfig {
  condition: string; // JavaScript expression
  trueSteps: string[]; // Step IDs
  falseSteps: string[]; // Step IDs
}

export interface LoopStepConfig {
  loopType: 'for' | 'foreach' | 'while';
  iterator: string;
  steps: string[]; // Step IDs to loop
}

export interface DelayStepConfig {
  durationMs: number;
}

export interface ScriptStepConfig {
  code: string; // JavaScript code
}

export interface VariableExtractor {
  name: string;
  source: 'body' | 'header' | 'status';
  path: string; // JSONPath, XPath, hoặc regex
  defaultValue?: any;
}

export interface Assertion {
  name: string;
  source: 'status' | 'body' | 'header' | 'duration';
  operator: 'equals' | 'contains' | 'matches' | 'greaterThan' | 'lessThan' | 'notEquals' | 'exists';
  expected: any;
  actual?: any;
  passed?: boolean;
  error?: string;
}

export interface TestScenarioRun {
  id: string;
  scenarioId: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'stopped';
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  durationMs?: number;
  startedAt: number;
  completedAt?: number;
  errorMessage?: string;
  results: TestStepResult[];
}

export interface TestStepResult {
  stepId: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  durationMs?: number;
  response?: APIResponse;
  assertions?: Assertion[];
  error?: string;
  extractedVariables?: Record<string, any>;
}
```

## 🔧 Implementation Plan

### Phase 1: Database & Backend Foundation

#### 1.1 Database Schema
- [ ] Tạo migration để thêm 3 bảng mới vào database
- [ ] Implement database functions trong `src-tauri/src/database.rs`:
  - `save_test_scenario()`
  - `get_test_scenarios_by_project()`
  - `delete_test_scenario()`
  - `save_test_scenario_step()`
  - `get_test_scenario_steps()`
  - `delete_test_scenario_step()`
  - `save_test_scenario_run()`
  - `get_test_scenario_runs()`

#### 1.2 Rust Types & Commands
- [ ] Thêm types vào `src-tauri/src/types.rs`
- [ ] Implement Tauri commands trong `src-tauri/src/commands.rs`:
  - `create_test_scenario()`
  - `get_test_scenarios()`
  - `update_test_scenario()`
  - `delete_test_scenario()`
  - `add_test_scenario_step()`
  - `update_test_scenario_step()`
  - `delete_test_scenario_step()`
  - `reorder_test_scenario_steps()`
  - `run_test_scenario()`
  - `stop_test_scenario()`
  - `get_test_scenario_runs()`

#### 1.3 Scenario Executor (Rust)
- [ ] Tạo module `src-tauri/src/scenario/executor.rs`
  - Variable resolver (resolve variables từ global, environment, local)
  - Request executor với variable injection
  - Response parser và variable extractor (JSONPath support)
  - Assertion evaluator
  - Condition evaluator (JavaScript expression)
  - Loop executor
  - Script executor (JavaScript runtime - có thể dùng `deno_core` hoặc `quickjs_rs`)

### Phase 2: Frontend Types & Services

#### 2.1 TypeScript Types
- [ ] Tạo `src/types/scenario.ts` với tất cả interfaces
- [ ] Export types từ `src/types/index.ts`

#### 2.2 Tauri Service
- [ ] Thêm methods vào `src/services/tauri.ts`:
  - `createTestScenario()`
  - `getTestScenarios()`
  - `updateTestScenario()`
  - `deleteTestScenario()`
  - `addTestScenarioStep()`
  - `updateTestScenarioStep()`
  - `deleteTestScenarioStep()`
  - `reorderTestScenarioSteps()`
  - `runTestScenario()`
  - `stopTestScenario()`
  - `getTestScenarioRuns()`

#### 2.3 React Hooks
- [ ] Tạo `src/hooks/useTestScenarios.ts` (tương tự `useTestSuites.ts`)
- [ ] Tạo `src/hooks/useTestScenarioRuns.ts`

### Phase 3: UI Components

#### 3.1 Scenario List Component
- [ ] Tạo `src/components/scenario/ScenarioList.tsx`
  - Hiển thị danh sách scenarios
  - Tạo/scửa/xóa scenario
  - Filter và search
  - Priority badges

#### 3.2 Scenario Editor Component
- [ ] Tạo `src/components/scenario/ScenarioEditor.tsx`
  - Form để edit scenario metadata (name, description, priority, variables)
  - Pre/Post script editor (Monaco Editor)
  - Step list với drag & drop để reorder
  - Add step buttons (Request, Condition, Loop, Delay, Script)

#### 3.3 Step Editor Components
- [ ] `src/components/scenario/steps/RequestStepEditor.tsx`
  - Endpoint selector (link to endpoint spec hoặc custom URL)
  - Method, URL, headers, params editor
  - Variable extractor builder (JSONPath, regex)
  - Assertion builder (status, body, header validations)
  
- [ ] `src/components/scenario/steps/ConditionStepEditor.tsx`
  - JavaScript expression editor
  - Step selector cho true/false branches
  
- [ ] `src/components/scenario/steps/LoopStepEditor.tsx`
  - Loop type selector (for/foreach/while)
  - Iterator expression
  - Step selector cho loop body
  
- [ ] `src/components/scenario/steps/DelayStepEditor.tsx`
  - Duration input (ms)
  
- [ ] `src/components/scenario/steps/ScriptStepEditor.tsx`
  - JavaScript code editor (Monaco Editor)

#### 3.4 Scenario Runner Component
- [ ] Tạo `src/components/scenario/ScenarioRunner.tsx`
  - Run/Stop/Pause controls
  - Real-time progress indicator
  - Step-by-step execution visualization
  - Results panel với assertions và extracted variables
  - Error handling và display

#### 3.5 Scenario Results Component
- [ ] Tạo `src/components/scenario/ScenarioResults.tsx`
  - Test run history
  - Detailed results view
  - Assertions breakdown
  - Variables snapshot
  - Export results (JSON, HTML report)

### Phase 4: Integration

#### 4.1 Sidebar Integration
- [ ] Thêm "Test Scenarios" section vào `src/components/layout/Sidebar.tsx`
- [ ] Navigation đến scenario editor/runner

#### 4.2 App Integration
- [ ] Thêm view mode "scenario" vào `src/App.tsx`
- [ ] Route handling cho scenario views

#### 4.3 Endpoint Integration
- [ ] Cho phép import endpoint vào scenario step
- [ ] Sync endpoint changes (nếu step linked to endpoint spec)

## 🎨 UI/UX Design Considerations

### Scenario Editor Layout
```
┌─────────────────────────────────────────────────────────┐
│ Scenario: [Name]                    [Save] [Run] [Delete]│
├─────────────────────────────────────────────────────────┤
│ Metadata Tab | Variables Tab | Pre-Script | Post-Script │
├─────────────────────────────────────────────────────────┤
│ Steps List (Drag & Drop)                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 1. [Request] Login API              [Edit] [Delete]  │ │
│ │ 2. [Condition] Check Status         [Edit] [Delete]  │ │
│ │ 3. [Request] Get User Info         [Edit] [Delete]  │ │
│ │ 4. [Loop] For each item            [Edit] [Delete]  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ [+ Add Step ▼]                                          │
└─────────────────────────────────────────────────────────┘
```

### Step Editor Modal/Drawer
```
┌─────────────────────────────────────────────────────────┐
│ Edit Step: Request Step                                  │
├─────────────────────────────────────────────────────────┤
│ Step Name: [________________]                            │
│                                                          │
│ Endpoint: [Select from endpoints ▼] or [Custom URL]      │
│ Method: [GET ▼]                                         │
│ URL: [http://...]                                        │
│                                                          │
│ Headers:                                                 │
│   Authorization: Bearer {{token}}                        │
│                                                          │
│ Parameters:                                             │
│   userId: {{userId}}                                     │
│                                                          │
│ Extract Variables:                                      │
│   [+ Add Extractor]                                     │
│   - token: body.token                                   │
│                                                          │
│ Assertions:                                              │
│   [+ Add Assertion]                                     │
│   - Status equals 200                                    │
│   - Body contains "success"                              │
│                                                          │
│ [Cancel] [Save]                                         │
└─────────────────────────────────────────────────────────┘
```

### Runner View
```
┌─────────────────────────────────────────────────────────┐
│ Running: Login Flow Scenario          [⏸ Pause] [⏹ Stop]│
├─────────────────────────────────────────────────────────┤
│ Progress: ████████░░░░░░░░░░ 4/10 steps                 │
├─────────────────────────────────────────────────────────┤
│ Step Results:                                            │
│ ✅ 1. Login API (200ms)                                  │
│    ✓ Status equals 200                                   │
│    ✓ Body contains "token"                               │
│    Variables: token = "abc123..."                        │
│                                                          │
│ ✅ 2. Check Status (150ms)                               │
│    ✓ Condition: status === 200                          │
│                                                          │
│ 🔄 3. Get User Info (running...)                        │
│                                                          │
│ ⏸ 4. Loop Items (pending)                               │
└─────────────────────────────────────────────────────────┘
```

## 🧪 Testing Strategy

### Unit Tests
- [ ] Test variable resolution logic
- [ ] Test JSONPath extraction
- [ ] Test assertion evaluation
- [ ] Test condition evaluation
- [ ] Test loop execution

### Integration Tests
- [ ] Test full scenario execution
- [ ] Test data passing between steps
- [ ] Test conditional branching
- [ ] Test loop execution
- [ ] Test error handling

### E2E Tests
- [ ] Create scenario from UI
- [ ] Add/edit/delete steps
- [ ] Run scenario and verify results
- [ ] Test variable extraction
- [ ] Test assertions

## 📚 Dependencies Cần Thêm

### Rust Backend
- `jsonpath_lib` hoặc `serde_json_path` - JSONPath support
- `deno_core` hoặc `quickjs_rs` - JavaScript runtime cho scripts và conditions
- `regex` - Regex support cho variable extraction

### Frontend
- `react-beautiful-dnd` hoặc `@dnd-kit/core` - Drag & drop cho step reordering
- `jsonpath-plus` - JSONPath evaluation (nếu cần client-side preview)
- Monaco Editor (đã có) - Code editing cho scripts

## 🚀 Migration Path

1. **Giữ nguyên Test Suite**: Test Suite hiện tại vẫn hoạt động bình thường
2. **Test Scenario là tính năng mới**: Không ảnh hưởng đến code cũ
3. **Có thể convert**: Tạo utility để convert Test Suite cũ thành Test Scenario (optional)

## 📝 Notes

- **JavaScript Runtime**: Cần chọn giữa `deno_core` (nặng hơn nhưng đầy đủ) hoặc `quickjs_rs` (nhẹ hơn nhưng ít features). Khuyến nghị bắt đầu với `quickjs_rs` cho đơn giản.
- **JSONPath**: Cần library hỗ trợ JSONPath để extract variables từ response body. Có thể dùng `jsonpath_lib` hoặc implement đơn giản với `serde_json`.
- **Performance**: Với scenarios lớn, cần optimize:
  - Lazy loading steps
  - Streaming results
  - Background execution
- **Error Handling**: Cần xử lý kỹ:
  - Network errors
  - Timeout
  - Invalid expressions
  - Circular dependencies trong variables
- **Security**: JavaScript execution cần sandbox để tránh security issues.

## ✅ Checklist Implementation

### Backend
- [ ] Database schema
- [ ] Rust types
- [ ] Database functions
- [ ] Tauri commands
- [ ] Scenario executor
- [ ] Variable resolver
- [ ] JSONPath extractor
- [ ] Assertion evaluator
- [ ] JavaScript runtime integration

### Frontend
- [ ] TypeScript types
- [ ] Tauri service methods
- [ ] React hooks
- [ ] Scenario list component
- [ ] Scenario editor component
- [ ] Step editor components (5 types)
- [ ] Scenario runner component
- [ ] Results component
- [ ] Sidebar integration
- [ ] App routing

### Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests

### Documentation
- [ ] User guide
- [ ] API documentation
- [ ] Examples

---

**Status**: 📝 Planning - Chưa implement
**Priority**: High
**Estimated Effort**: 3-4 weeks
**Dependencies**: None (có thể build song song với code hiện tại)

