export type ScanType =
  | 'SqlInjection'
  | 'XssInjection'
  | 'XPathInjection'
  | 'MalformedXml'
  | 'XmlBomb'
  | 'FuzzingScan'
  | 'BoundaryScan'
  | 'InvalidTypes';

export const SCAN_TYPE_LABELS: Record<ScanType, string> = {
  SqlInjection: 'SQL Injection',
  XssInjection: 'Cross Site Scripting',
  XPathInjection: 'XPath Injection',
  MalformedXml: 'Malformed XML',
  XmlBomb: 'XML Bomb',
  FuzzingScan: 'Fuzzing Scan',
  BoundaryScan: 'Boundary Scan',
  InvalidTypes: 'Invalid Types',
};

export type AssertionType = 'StatusCodeNot' | 'BodyNotContains' | 'ResponseTime';

export interface Assertion {
  assertionType: AssertionType;
  expected: string;
}

export interface ScanConfig {
  scanType: ScanType;
  enabled: boolean;
  assertions: Assertion[];
}

export interface SecurityTestCase {
  id: string;
  projectId: string;
  name: string;
  endpointId?: string;
  scans: ScanConfig[];
  createdAt: number;
  updatedAt: number;
}

export type ScanStatus = 'Pending' | 'Running' | 'Pass' | 'Fail' | 'Error';

export type AlertSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';

export interface SecurityAlert {
  severity: AlertSeverity;
  message: string;
  payload: string;
  responseSnippet?: string;
}

export interface SecurityScanResult {
  id: string;
  testCaseId: string;
  scanType: ScanType;
  status: ScanStatus;
  requestsSent: number;
  alerts: SecurityAlert[];
  durationMs: number;
  startedAt: number;
  completedAt: number;
}

export interface SecurityTestRun {
  id: string;
  testCaseId: string;
  status: ScanStatus;
  totalScans: number;
  completedScans: number;
  totalRequests: number;
  totalAlerts: number;
  results: SecurityScanResult[];
  startedAt: number;
  completedAt?: number;
}

// Default scan configs for new test cases
export const DEFAULT_SCANS: ScanConfig[] = [
  { scanType: 'SqlInjection', enabled: true, assertions: [] },
  { scanType: 'XssInjection', enabled: true, assertions: [] },
  { scanType: 'XPathInjection', enabled: false, assertions: [] },
  { scanType: 'MalformedXml', enabled: false, assertions: [] },
  { scanType: 'XmlBomb', enabled: false, assertions: [] },
  { scanType: 'FuzzingScan', enabled: true, assertions: [] },
  { scanType: 'BoundaryScan', enabled: true, assertions: [] },
  { scanType: 'InvalidTypes', enabled: true, assertions: [] },
];
