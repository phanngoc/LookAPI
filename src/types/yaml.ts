/**
 * YAML Types for Test Scenarios
 * 
 * These types mirror the Rust YAML types and are used for
 * import/export functionality in the frontend.
 */

// ============================================================================
// Single Scenario YAML Format
// ============================================================================

export interface ScenarioYaml {
  name: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  baseUrl?: string;
  variables: Record<string, any>;
  preScript?: string;
  postScript?: string;
  steps: StepYaml[];
}

export interface StepYaml {
  name: string;
  enabled?: boolean;
  request?: RequestYaml;
  delay?: DelayYaml;
  script?: ScriptYaml;
  condition?: ConditionYaml;
  loop?: LoopYaml;
  extract?: ExtractorYaml[];
  assertions?: AssertionYaml[];
}

export interface RequestYaml {
  method: string;
  url: string;
  headers?: Record<string, string>;
  params?: any;
  body?: any;
}

export interface DelayYaml {
  duration: number; // milliseconds
}

export interface ScriptYaml {
  code: string;
}

export interface ConditionYaml {
  condition: string;
  trueSteps: string[];
  falseSteps: string[];
}

export interface LoopYaml {
  type: 'for' | 'foreach' | 'while';
  count?: number;
  iteratorVariable?: string;
  dataSource?: string;
  steps: string[];
}

export interface ExtractorYaml {
  name: string;
  source: 'body' | 'header' | 'status';
  path: string;
  defaultValue?: any;
}

export interface AssertionYaml {
  name: string;
  source: 'status' | 'body' | 'header' | 'duration';
  path?: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'matches' | 'greaterThan' | 'lessThan' | 'exists';
  expected: any;
}

// ============================================================================
// Project YAML Format (Multiple Scenarios)
// ============================================================================

export interface ProjectScenariosYaml {
  projectName: string;
  baseUrl?: string;
  exportedAt: string;
  scenarios: ScenarioYaml[];
}

// ============================================================================
// Import Preview Types
// ============================================================================

export interface ScenarioImportPreview {
  name: string;
  description?: string;
  priority: string;
  stepsCount: number;
  variablesCount: number;
  steps: StepPreview[];
}

export interface StepPreview {
  name: string;
  stepType: string;
  enabled: boolean;
}

export interface ProjectImportPreview {
  projectName: string;
  scenariosCount: number;
  totalSteps: number;
  scenarios: ScenarioImportPreview[];
}

// ============================================================================
// YAML Editor State Types
// ============================================================================

export interface YamlEditorState {
  content: string;
  isValid: boolean;
  error?: string;
  preview?: ScenarioImportPreview;
}

export interface YamlValidationResult {
  isValid: boolean;
  error?: string;
  preview?: ScenarioImportPreview;
}

// ============================================================================
// AI Generation Types
// ============================================================================

export interface ScenarioGenerateRequest {
  prompt: string;
  projectId: string;
  includeEndpoints: boolean;
}

export interface ScenarioGenerateResponse {
  yamlContent: string;
  suggestedName: string;
  preview: ScenarioImportPreview;
}

// ============================================================================
// Export/Import Request Types
// ============================================================================

export interface ExportScenarioRequest {
  scenarioId: string;
  baseUrl?: string;
}

export interface ExportProjectRequest {
  projectId: string;
}

export interface ImportScenarioRequest {
  projectId: string;
  yamlContent: string;
}

export interface ImportProjectRequest {
  projectId: string;
  yamlContent: string;
}
