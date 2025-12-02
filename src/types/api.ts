export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  lastScanned: number | null;
}

export interface APIEndpoint {
  id: string;
  projectId?: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | string;
  path: string;
  service: string;
  description: string;
  parameters: APIParameter[];
  category: string;
  explanation?: string;
}

export interface APIParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  example?: any;
  defaultValue?: any;
}

export interface APIRequest {
  endpoint: string;
  method: string;
  parameters: Record<string, any>;
  headers?: Record<string, string>;
}

export interface APIResponse {
  status: number;
  statusText: string;
  data: any;
  headers: Record<string, string>;
  duration: number;
  timestamp: string;
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  endpoints: string[];
  category: string;
}

export interface QueryResult {
  columns: string[];
  rows: any[][];
  row_count: number;
}

export interface ExecutionLog {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  data?: any;
}
