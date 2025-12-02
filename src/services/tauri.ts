import { invoke } from '@tauri-apps/api/core';
import { APIEndpoint, APIRequest, APIResponse, TestSuite, QueryResult } from '../types/api';

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
};
