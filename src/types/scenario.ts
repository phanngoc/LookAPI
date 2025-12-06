// Test Scenario Types

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
  body?: any;
  extractVariables?: VariableExtractor[];
  assertions?: Assertion[];
}

export interface ConditionStepConfig {
  condition: string;
  trueSteps: string[];
  falseSteps: string[];
}

export interface LoopStepConfig {
  loopType: 'for' | 'foreach' | 'while';
  count?: number;
  iteratorVariable?: string;
  dataSource?: string;
  steps: string[];
}

export interface DelayStepConfig {
  durationMs: number;
}

export interface ScriptStepConfig {
  code: string;
}

export interface VariableExtractor {
  name: string;
  source: 'body' | 'header' | 'status';
  path: string;
  defaultValue?: any;
}

export interface Assertion {
  name: string;
  source: 'status' | 'body' | 'header' | 'duration';
  path?: string;
  operator: 'equals' | 'contains' | 'matches' | 'greaterThan' | 'lessThan' | 'notEquals' | 'exists';
  expected: any;
  actual?: any;
  passed?: boolean;
  error?: string;
}

export type ScenarioRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'stopped' | 'error';
export type StepResultStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'error';

export interface TestScenarioRun {
  id: string;
  scenarioId: string;
  status: ScenarioRunStatus;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  durationMs?: number;
  startedAt: number;
  completedAt?: number;
  errorMessage?: string;
  results: TestStepResult[];
  variables: Record<string, any>;
}

export interface TestStepResult {
  stepId: string;
  name: string;
  stepType: TestStepType;
  status: StepResultStatus;
  durationMs?: number;
  response?: StepResponse;
  assertions?: Assertion[];
  error?: string;
  extractedVariables?: Record<string, any>;
}

export interface StepResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  durationMs: number;
}

// Request types for API calls
export interface CreateScenarioRequest {
  projectId: string;
  name: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface UpdateScenarioRequest {
  id: string;
  name?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  variables?: Record<string, any>;
  preScript?: string;
  postScript?: string;
}

export interface CreateStepRequest {
  scenarioId: string;
  stepType: TestStepType;
  name: string;
  config: RequestStepConfig | ConditionStepConfig | LoopStepConfig | DelayStepConfig | ScriptStepConfig;
}

export interface UpdateStepRequest {
  id: string;
  name?: string;
  config?: RequestStepConfig | ConditionStepConfig | LoopStepConfig | DelayStepConfig | ScriptStepConfig;
  enabled?: boolean;
}

export interface ReorderStepsRequest {
  scenarioId: string;
  stepIds: string[];
}

// UI Helper types
export const STEP_TYPE_LABELS: Record<TestStepType, string> = {
  request: 'HTTP Request',
  condition: 'Condition',
  loop: 'Loop',
  delay: 'Delay',
  script: 'Script',
};

export const STEP_TYPE_ICONS: Record<TestStepType, string> = {
  request: 'Send',
  condition: 'GitBranch',
  loop: 'Repeat',
  delay: 'Clock',
  script: 'Code',
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-slate-500 bg-slate-100',
  medium: 'text-amber-600 bg-amber-100',
  high: 'text-red-600 bg-red-100',
};

export const STATUS_COLORS: Record<ScenarioRunStatus | StepResultStatus, string> = {
  pending: 'text-slate-500 bg-slate-100',
  running: 'text-blue-600 bg-blue-100',
  passed: 'text-emerald-600 bg-emerald-100',
  failed: 'text-red-600 bg-red-100',
  stopped: 'text-amber-600 bg-amber-100',
  skipped: 'text-slate-400 bg-slate-50',
  error: 'text-red-600 bg-red-100',
};

export const ASSERTION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'notEquals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'matches', label: 'Matches (Regex)' },
  { value: 'greaterThan', label: 'Greater Than' },
  { value: 'lessThan', label: 'Less Than' },
  { value: 'exists', label: 'Exists' },
];

export const ASSERTION_SOURCES = [
  { value: 'status', label: 'Status Code' },
  { value: 'body', label: 'Response Body' },
  { value: 'header', label: 'Response Header' },
  { value: 'duration', label: 'Response Duration (ms)' },
];

export const EXTRACTOR_SOURCES = [
  { value: 'body', label: 'Response Body' },
  { value: 'header', label: 'Response Header' },
  { value: 'status', label: 'Status Code' },
];

// Default configs for new steps
export const DEFAULT_REQUEST_CONFIG: RequestStepConfig = {
  url: '',
  method: 'GET',
  headers: {},
  params: {},
  extractVariables: [],
  assertions: [],
};

export const DEFAULT_DELAY_CONFIG: DelayStepConfig = {
  durationMs: 1000,
};

export const DEFAULT_SCRIPT_CONFIG: ScriptStepConfig = {
  code: '// Write your JavaScript code here\n',
};

export const DEFAULT_CONDITION_CONFIG: ConditionStepConfig = {
  condition: '',
  trueSteps: [],
  falseSteps: [],
};

export const DEFAULT_LOOP_CONFIG: LoopStepConfig = {
  loopType: 'for',
  count: 1,
  steps: [],
};

// Event payload types for real-time progress updates
export interface ScenarioStartedEvent {
  runId: string;
  scenarioId: string;
  totalSteps: number;
  startedAt: number;
}

export interface StepStartedEvent {
  runId: string;
  stepId: string;
  stepIndex: number;
  stepName: string;
  stepType: string;
}

export interface StepCompletedEvent {
  runId: string;
  stepId: string;
  stepIndex: number;
  status: string;
  result: TestStepResult;
  progressPercentage: number;
}

export interface ScenarioCompletedEvent {
  runId: string;
  run: TestScenarioRun;
}

