import { APIEndpoint, APIResponse } from './api';

export interface RequestTab {
  id: string;
  endpoint: APIEndpoint | null; // null for empty/custom requests
  method: string;
  url: string;
  bodyJson: string;
  headersJson: string;
  response: APIResponse | null;
  error: string | null;
  isExecuting: boolean;
  activeTab: 'body' | 'headers' | 'response-schema';
  name: string;
  createdAt: number;
  updatedAt: number;
  curlCommand?: string;
}

export interface RequestTabState {
  tabs: RequestTab[];
  activeTabId: string | null;
}
