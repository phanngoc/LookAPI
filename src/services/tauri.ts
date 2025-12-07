import { invoke } from '@tauri-apps/api/core';
import { APIEndpoint, APIRequest, APIResponse, TestSuite, QueryResult, Project } from '../types/api';
import { SecurityTestCase, SecurityTestRun, ScanConfig } from '../types/security';
import {
  TestScenario,
  TestScenarioStep,
  TestScenarioRun,
  UpdateScenarioRequest,
  CreateStepRequest,
  UpdateStepRequest,
  ReorderStepsRequest,
} from '../types/scenario';
import {
  ScenarioImportPreview,
  ProjectImportPreview,
} from '../types/yaml';

export const tauriService = {
  async executeHttpRequest(request: APIRequest): Promise<APIResponse> {
    return invoke('execute_http_request', { request });
  },

  async generateCurlCommand(url: string, method: string, body?: any): Promise<string> {
    return invoke('generate_curl_command', { url, method, body });
  },

  async getAllEndpoints(): Promise<APIEndpoint[]> {
    return invoke('get_all_endpoints');
  },

  async saveEndpoint(endpoint: APIEndpoint): Promise<void> {
    return invoke('save_endpoint', { endpoint });
  },

  async getAllTestSuites(): Promise<TestSuite[]> {
    return invoke('get_all_test_suites');
  },

  async executeSqlQuery(dbPath: string, query: string): Promise<QueryResult> {
    return invoke('execute_sql_query', { dbPath, query });
  },

  async exportResponse(filename: string, content: string): Promise<string> {
    return invoke('export_response', { filename, content });
  },

  // Project management
  async openFolderDialog(): Promise<string | null> {
    return invoke('open_folder_dialog');
  },

  async createProject(path: string): Promise<Project> {
    return invoke('create_project', { path });
  },

  async getAllProjects(): Promise<Project[]> {
    return invoke('get_all_projects');
  },

  async deleteProject(projectId: string): Promise<void> {
    return invoke('delete_project', { projectId });
  },

  async updateProjectBaseUrl(projectId: string, baseUrl: string | null): Promise<void> {
    return invoke('update_project_base_url', { projectId, baseUrl });
  },

  async getEndpointsByProject(projectId: string): Promise<APIEndpoint[]> {
    return invoke('get_endpoints_by_project', { projectId });
  },

  async scanProject(projectId: string, projectPath: string): Promise<APIEndpoint[]> {
    return invoke('scan_project', { projectId, projectPath });
  },

  // Security testing
  async createSecurityTestCase(
    projectId: string,
    name: string,
    endpointId: string | null,
    scans: ScanConfig[]
  ): Promise<SecurityTestCase> {
    return invoke('create_security_test_case', { projectId, name, endpointId, scans });
  },

  async getSecurityTestCases(projectId: string): Promise<SecurityTestCase[]> {
    return invoke('get_security_test_cases', { projectId });
  },

  async deleteSecurityTestCase(id: string): Promise<void> {
    return invoke('delete_security_test_case', { id });
  },

  async runSecurityTest(
    testCase: SecurityTestCase,
    url: string,
    method: string,
    params: Record<string, any>,
    headers: Record<string, string>
  ): Promise<SecurityTestRun> {
    return invoke('run_security_test', { testCase, url, method, params, headers });
  },

  async getSecurityTestRuns(testCaseId: string): Promise<SecurityTestRun[]> {
    return invoke('get_security_test_runs', { testCaseId });
  },

  // ============================================================================
  // Test Scenario APIs
  // ============================================================================

  async createTestScenario(
    projectId: string,
    name: string,
    description?: string,
    priority?: 'low' | 'medium' | 'high'
  ): Promise<TestScenario> {
    return invoke('create_test_scenario', { projectId, name, description, priority });
  },

  async getTestScenarios(projectId: string): Promise<TestScenario[]> {
    return invoke('get_test_scenarios', { projectId });
  },

  async getTestScenario(scenarioId: string): Promise<TestScenario | null> {
    return invoke('get_test_scenario', { scenarioId });
  },

  async updateTestScenario(request: UpdateScenarioRequest): Promise<TestScenario> {
    return invoke('update_test_scenario', { request });
  },

  async deleteTestScenario(scenarioId: string): Promise<void> {
    return invoke('delete_test_scenario', { scenarioId });
  },

  async addTestScenarioStep(request: CreateStepRequest): Promise<TestScenarioStep> {
    return invoke('add_test_scenario_step', { request });
  },

  async getTestScenarioSteps(scenarioId: string): Promise<TestScenarioStep[]> {
    return invoke('get_test_scenario_steps', { scenarioId });
  },

  async updateTestScenarioStep(request: UpdateStepRequest): Promise<TestScenarioStep> {
    return invoke('update_test_scenario_step', { request });
  },

  async deleteTestScenarioStep(stepId: string): Promise<void> {
    return invoke('delete_test_scenario_step', { stepId });
  },

  async reorderTestScenarioSteps(request: ReorderStepsRequest): Promise<void> {
    return invoke('reorder_test_scenario_steps', { request });
  },

  async runTestScenario(scenarioId: string): Promise<TestScenarioRun> {
    return invoke('run_test_scenario', { scenarioId });
  },

  async getTestScenarioRuns(scenarioId: string): Promise<TestScenarioRun[]> {
    return invoke('get_test_scenario_runs', { scenarioId });
  },

  // ============================================================================
  // YAML Export/Import APIs
  // ============================================================================

  /**
   * Export a single scenario to YAML string
   */
  async exportScenarioYaml(scenarioId: string, baseUrl?: string): Promise<string> {
    return invoke('export_scenario_yaml', { scenarioId, baseUrl });
  },

  /**
   * Export all scenarios in a project to YAML string
   */
  async exportProjectScenariosYaml(projectId: string): Promise<string> {
    return invoke('export_project_scenarios_yaml', { projectId });
  },

  /**
   * Preview a scenario import from YAML (dry run)
   */
  async previewScenarioYamlImport(yamlContent: string): Promise<ScenarioImportPreview> {
    return invoke('preview_scenario_yaml_import', { yamlContent });
  },

  /**
   * Preview a project scenarios import from YAML (dry run)
   */
  async previewProjectScenariosYamlImport(yamlContent: string): Promise<ProjectImportPreview> {
    return invoke('preview_project_scenarios_yaml_import', { yamlContent });
  },

  /**
   * Import a single scenario from YAML
   */
  async importScenarioYaml(projectId: string, yamlContent: string): Promise<TestScenario> {
    return invoke('import_scenario_yaml', { projectId, yamlContent });
  },

  /**
   * Import multiple scenarios from project YAML
   */
  async importProjectScenariosYaml(projectId: string, yamlContent: string): Promise<TestScenario[]> {
    return invoke('import_project_scenarios_yaml', { projectId, yamlContent });
  },

  /**
   * Get YAML template for AI tools
   */
  async getYamlTemplate(): Promise<string> {
    return invoke('get_yaml_template');
  },
};
