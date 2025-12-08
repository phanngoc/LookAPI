export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  lastScanned: number | null;
  baseUrl?: string;
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
  responses?: APIResponseDefinition[];
}

export interface APIResponseDefinition {
  statusCode: number;
  description: string;
  contentType: string;
  schema?: ResponseSchema;
  example?: any;
}

export interface ResponseSchema {
  schemaType: string;
  properties: ResponseProperty[];
  isWrapped: boolean;
  itemsSchema?: ResponseSchema;
  refName?: string;
}

export interface ResponseProperty {
  name: string;
  propertyType: string;
  required: boolean;
  description?: string;
  nestedProperties?: ResponseProperty[];
  itemsType?: string;
  example?: any;
  format?: string;
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
