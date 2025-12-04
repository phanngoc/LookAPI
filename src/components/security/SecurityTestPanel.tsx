import { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Play,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  RotateCcw,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { Input } from '@/components/ui/input';
import { MethodBadge } from '@/components/shared/MethodBadge';
import { tauriService } from '@/services/tauri';
import { useEndpoints } from '@/hooks/useEndpoints';
import { cn } from '@/lib/utils';
import {
  SecurityTestCase,
  SecurityTestRun,
  ScanType,
  SCAN_TYPE_LABELS,
  DEFAULT_SCANS,
  ScanStatus,
  AlertSeverity,
} from '@/types/security';

interface Props {
  projectId: string;
  endpointId?: string;
  url: string;
  method: string;
  params: Record<string, any>;
  headers: Record<string, string>;
}

export function SecurityTestPanel({ projectId, endpointId, url, method, params, headers }: Props) {
  const [testCases, setTestCases] = useState<SecurityTestCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<SecurityTestCase | null>(null);
  const [currentRun, setCurrentRun] = useState<SecurityTestRun | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const { endpoints } = useEndpoints(projectId);

  useEffect(() => {
    loadTestCases();
  }, [projectId]);

  const selectedEndpoint = useMemo(() => {
    if (!selectedCase?.endpointId) return null;
    return endpoints.find((e) => e.id === selectedCase.endpointId) || null;
  }, [selectedCase?.endpointId, endpoints]);

  const loadTestCases = async () => {
    try {
      const cases = await tauriService.getSecurityTestCases(projectId);
      setTestCases(cases);
    } catch (e) {
      console.error('Failed to load test cases:', e);
    }
  };

  const createTestCase = async () => {
    if (!newName.trim()) return;
    try {
      const testCase = await tauriService.createSecurityTestCase(
        projectId,
        newName,
        endpointId || null,
        DEFAULT_SCANS
      );
      setTestCases([...testCases, testCase]);
      setSelectedCase(testCase);
      setNewName('');
      setShowCreate(false);
    } catch (e) {
      console.error('Failed to create test case:', e);
    }
  };

  const deleteTestCase = async (id: string) => {
    try {
      await tauriService.deleteSecurityTestCase(id);
      setTestCases(testCases.filter((tc) => tc.id !== id));
      if (selectedCase?.id === id) setSelectedCase(null);
    } catch (e) {
      console.error('Failed to delete test case:', e);
    }
  };

  const runTest = async () => {
    if (!selectedCase || !url) return;
    setIsRunning(true);
    setCurrentRun(null);
    try {
      const run = await tauriService.runSecurityTest(selectedCase, url, method, params, headers);
      setCurrentRun(run);
    } catch (e) {
      console.error('Security test failed:', e);
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setCurrentRun(null);
  };

  const toggleScan = (scanType: ScanType) => {
    if (!selectedCase) return;
    const updated = {
      ...selectedCase,
      scans: selectedCase.scans.map((s) =>
        s.scanType === scanType ? { ...s, enabled: !s.enabled } : s
      ),
    };
    setSelectedCase(updated);
  };

  const getStatusIcon = (status: ScanStatus) => {
    switch (status) {
      case 'Pass':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'Fail':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'Running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: ScanStatus) => {
    switch (status) {
      case 'Pass':
        return <Badge variant="success">Pass</Badge>;
      case 'Fail':
        return <Badge variant="destructive">Fail</Badge>;
      case 'Running':
        return <Badge variant="default">Running</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'Critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'High':
        return <Badge variant="destructive">High</Badge>;
      case 'Medium':
        return <Badge variant="warning">Medium</Badge>;
      case 'Low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="px-4 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-100">
            <Shield className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">Security Testing</h2>
            <p className="text-sm text-slate-500">Scan APIs for vulnerabilities and security issues</p>
          </div>
        </div>

        {selectedCase && (
          <>
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-slate-900 mb-1">{selectedCase.name}</h3>
                {selectedEndpoint && (
                  <div className="flex items-center gap-2 mt-1">
                    <MethodBadge method={selectedEndpoint.method} className="text-[10px] px-1.5" />
                    <span className="text-xs text-slate-500 font-mono">{selectedEndpoint.path}</span>
                  </div>
                )}
                {url && (
                  <div className="flex items-center gap-2 mt-1">
                    <MethodBadge method={method} className="text-[10px] px-1.5" />
                    <span className="text-xs text-slate-500 font-mono truncate max-w-md">{url}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {currentRun && (
                  <Button variant="outline" size="sm" onClick={handleReset} disabled={isRunning}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    Reset
                  </Button>
                )}
                <Button size="sm" onClick={runTest} disabled={isRunning || !url}>
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  {isRunning ? 'Running...' : 'Run Test'}
                </Button>
              </div>
            </div>

            {currentRun && (
              <>
                <Separator className="my-3" />
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    {getStatusIcon(currentRun.status)}
                    <span className="font-medium text-slate-700">
                      {currentRun.status === 'Pass' ? 'All tests passed' : `${currentRun.totalAlerts} alerts found`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <span>{currentRun.completedScans} / {currentRun.totalScans} scans</span>
                    <span>•</span>
                    <span>{currentRun.totalRequests} requests</span>
                  </div>
                </div>
                {isRunning && (
                  <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${(currentRun.completedScans / currentRun.totalScans) * 100}%` }}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Main Content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Test Cases List */}
        <ResizablePanel defaultSize={35} minSize={25}>
          <div className="h-full flex flex-col bg-white border-r border-slate-200">
            <div className="p-3 border-b border-slate-200">
              {showCreate ? (
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Test name..."
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && createTestCase()}
                    autoFocus
                  />
                  <Button size="sm" onClick={createTestCase}>
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowCreate(false);
                      setNewName('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="w-full" onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  New Test Case
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1">
              {testCases.length === 0 ? (
                <div className="p-6">
                  <Card className="border-dashed">
                    <CardHeader className="text-center">
                      <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                        <Shield className="w-5 h-5 text-slate-400" />
                      </div>
                      <CardTitle className="text-base">No Test Cases</CardTitle>
                      <CardDescription>Create your first security test case to get started</CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {testCases.map((tc) => {
                    const enabledCount = tc.scans.filter((s) => s.enabled).length;
                    return (
                      <button
                        key={tc.id}
                        onClick={() => setSelectedCase(tc)}
                        className={cn(
                          'w-full text-left p-3 rounded-lg border transition-all',
                          selectedCase?.id === tc.id
                            ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500 ring-offset-1'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">{tc.name}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {enabledCount} / {tc.scans.length} scans enabled
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTestCase(tc.id);
                              }}
                              className="p-1 hover:bg-slate-200 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Test Configuration & Results */}
        <ResizablePanel defaultSize={65} minSize={40}>
          {selectedCase ? (
            <div className="h-full flex flex-col bg-white">
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {/* API Info Section */}
                  {(url || selectedEndpoint) && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">API Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {selectedEndpoint && (
                          <div>
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Endpoint
                            </span>
                            <div className="mt-1 flex items-center gap-2">
                              <MethodBadge method={selectedEndpoint.method} />
                              <span className="text-sm font-mono text-slate-700">{selectedEndpoint.path}</span>
                            </div>
                          </div>
                        )}
                        {url && (
                          <div>
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Request URL
                            </span>
                            <div className="mt-1 flex items-center gap-2">
                              <MethodBadge method={method} />
                              <span className="text-sm font-mono text-slate-700 break-all">{url}</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Scan Configuration */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Scan Configuration</CardTitle>
                      <CardDescription>
                        Select which security scans to run on this API endpoint
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedCase.scans.map((scan) => (
                          <label
                            key={scan.scanType}
                            className={cn(
                              'flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all',
                              scan.enabled
                                ? 'bg-blue-50 border-blue-200'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={scan.enabled}
                              onChange={() => toggleScan(scan.scanType)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-700">{SCAN_TYPE_LABELS[scan.scanType]}</span>
                          </label>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Results */}
                  {currentRun && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-slate-900">Test Results</h3>
                        {getStatusBadge(currentRun.status)}
                      </div>

                      {currentRun.results.map((result) => (
                        <Card
                          key={result.id}
                          className={cn(
                            result.status === 'Fail' && 'border-red-200 bg-red-50/50',
                            result.status === 'Pass' && 'border-emerald-200 bg-emerald-50/50'
                          )}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(result.status)}
                                <CardTitle className="text-sm">{SCAN_TYPE_LABELS[result.scanType]}</CardTitle>
                              </div>
                              {getStatusBadge(result.status)}
                            </div>
                            <CardDescription className="text-xs">
                              {result.requestsSent} requests • {result.durationMs}ms
                            </CardDescription>
                          </CardHeader>

                          {result.alerts.length > 0 && (
                            <CardContent className="pt-0 space-y-2">
                              {result.alerts.map((alert, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    'p-3 rounded-lg border',
                                    alert.severity === 'Critical' || alert.severity === 'High'
                                      ? 'bg-red-50 border-red-200'
                                      : 'bg-amber-50 border-amber-200'
                                  )}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-slate-900">{alert.message}</span>
                                    {getSeverityBadge(alert.severity)}
                                  </div>
                                  <div className="text-xs text-slate-600 font-mono bg-white/50 p-2 rounded mt-1">
                                    Payload: {alert.payload}
                                  </div>
                                  {alert.responseSnippet && (
                                    <div className="text-xs text-slate-600 font-mono bg-white/50 p-2 rounded mt-1">
                                      Response: {alert.responseSnippet}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}

                  {!currentRun && !isRunning && (
                    <Card className="border-dashed">
                      <CardHeader className="text-center">
                        <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                          <Play className="w-5 h-5 text-slate-400" />
                        </div>
                        <CardTitle className="text-base">No Results Yet</CardTitle>
                        <CardDescription>Click "Run Test" to start security scanning</CardDescription>
                      </CardHeader>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-slate-50">
              <Card className="w-80 text-center border-dashed">
                <CardHeader>
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                    <Shield className="w-6 h-6 text-slate-400" />
                  </div>
                  <CardTitle className="text-base">Select a Test Case</CardTitle>
                  <CardDescription>Select or create a security test case to get started</CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
