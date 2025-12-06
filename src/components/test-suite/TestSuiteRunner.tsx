import { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RotateCcw,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MethodBadge } from '@/components/shared/MethodBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CodeEditor } from '@/components/shared/CodeEditor';
import { TestSuite, APIEndpoint, APIResponse } from '@/types/api';
import { useEndpoints } from '@/hooks/useEndpoints';
import { useProject } from '@/contexts/ProjectContext';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import { tauriService } from '@/services/tauri';
import { cn } from '@/lib/utils';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { getBaseUrlForProject, buildFullUrl } from '@/utils/url';

interface TestSuiteRunnerProps {
  testSuite: TestSuite;
}

interface TestResult {
  endpointId: string;
  endpoint: APIEndpoint;
  status: 'pending' | 'running' | 'success' | 'error';
  response?: APIResponse;
  error?: string;
  duration?: number;
}

export function TestSuiteRunner({ testSuite }: TestSuiteRunnerProps) {
  const { endpoints } = useEndpoints();
  const { currentProject } = useProject();
  const { getVariable } = useEnvironment();
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);

  // Initialize test results when suite changes
  useEffect(() => {
    const testEndpoints = testSuite.endpoints
      .map((id) => endpoints.find((e) => e.id === id))
      .filter(Boolean) as APIEndpoint[];

    const initialResults: TestResult[] = testEndpoints.map((endpoint) => ({
      endpointId: endpoint.id,
      endpoint,
      status: 'pending',
    }));

    setResults(initialResults);
    setCurrentIndex(0);
    setIsRunning(false);
    setIsPaused(false);
    setSelectedResult(null);
  }, [testSuite, endpoints]);

  const executeTest = async (result: TestResult) => {
    const { endpoint } = result;

    const parameters = endpoint.parameters.reduce((acc, param) => {
      acc[param.name] = param.defaultValue ?? param.example ?? '';
      return acc;
    }, {} as Record<string, unknown>);

    // Use project base URL settings
    const envBaseUrl = getVariable('BASE_URL');
    const baseUrl = getBaseUrlForProject(currentProject, envBaseUrl, endpoint.service);
    const url = buildFullUrl(baseUrl, endpoint.path);

    const request = {
      endpoint: url,
      method: endpoint.method,
      parameters,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const startTime = Date.now();

    try {
      const response = await tauriService.executeHttpRequest(request);
      const duration = Date.now() - startTime;

      return {
        ...result,
        status: 'success' as const,
        response,
        duration,
      };
    } catch (err: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      return {
        ...result,
        status: 'error' as const,
        error: errorMessage || 'Request failed',
        duration,
      };
    }
  };

  const runTests = async () => {
    setIsRunning(true);
    setIsPaused(false);

    for (let i = currentIndex; i < results.length; i++) {
      if (isPaused) {
        setCurrentIndex(i);
        break;
      }

      setResults((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: 'running' } : r))
      );
      setCurrentIndex(i);

      const updatedResult = await executeTest(results[i]);

      setResults((prev) =>
        prev.map((r, idx) => (idx === i ? updatedResult : r))
      );

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setIsRunning(false);
  };

  const handleRun = () => {
    if (isPaused) {
      setIsPaused(false);
      runTests();
    } else {
      setCurrentIndex(0);
      setResults((prev) => prev.map((r) => ({ ...r, status: 'pending' as const })));
      runTests();
    }
  };

  const handlePause = () => {
    setIsPaused(true);
    setIsRunning(false);
  };

  const handleStop = () => {
    setIsRunning(false);
    setIsPaused(false);
    setCurrentIndex(0);
    setResults((prev) =>
      prev.map((r) => (r.status === 'running' ? { ...r, status: 'pending' } : r))
    );
  };

  const handleReset = () => {
    setResults((prev) =>
      prev.map((r) => ({
        ...r,
        status: 'pending',
        response: undefined,
        error: undefined,
        duration: undefined,
      }))
    );
    setCurrentIndex(0);
    setSelectedResult(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-slate-300" />;
    }
  };

  const successCount = results.filter((r) => r.status === 'success').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  const pendingCount = results.filter((r) => r.status === 'pending').length;
  const totalCount = results.length;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="px-4 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100">
            <Layers className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">{testSuite.name}</h2>
            <p className="text-sm text-slate-500">{testSuite.description}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>Progress</span>
            <span>
              {successCount + errorCount} / {totalCount} completed
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full flex">
              <div
                className="bg-emerald-500 transition-all duration-300"
                style={{ width: `${(successCount / totalCount) * 100}%` }}
              />
              <div
                className="bg-red-500 transition-all duration-300"
                style={{ width: `${(errorCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats & Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="font-medium text-slate-700">{successCount}</span>
              <span className="text-slate-400">passed</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="font-medium text-slate-700">{errorCount}</span>
              <span className="text-slate-400">failed</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="font-medium text-slate-700">{pendingCount}</span>
              <span className="text-slate-400">pending</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={isRunning}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStop}
              disabled={!isRunning && !isPaused}
            >
              <Square className="w-3.5 h-3.5 mr-1.5" />
              Stop
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePause}
              disabled={!isRunning}
            >
              <Pause className="w-3.5 h-3.5 mr-1.5" />
              Pause
            </Button>
            <Button size="sm" onClick={handleRun} disabled={isRunning}>
              <Play className="w-3.5 h-3.5 mr-1.5" />
              {isPaused ? 'Resume' : 'Run All'}
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Test List */}
        <ResizablePanel defaultSize={45} minSize={30}>
          <ScrollArea className="h-full bg-white border-r border-slate-200">
            <div className="p-3 space-y-1">
              {results.map((result) => (
                <button
                  key={result.endpointId}
                  onClick={() => setSelectedResult(result)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-all',
                    result.status === 'success' && 'bg-emerald-50 border-emerald-200',
                    result.status === 'error' && 'bg-red-50 border-red-200',
                    result.status === 'running' && 'bg-blue-50 border-blue-200',
                    result.status === 'pending' && 'bg-slate-50 border-slate-200',
                    selectedResult?.endpointId === result.endpointId &&
                      'ring-2 ring-blue-500 ring-offset-1'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white shadow-sm">
                      {getStatusIcon(result.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <MethodBadge
                          method={result.endpoint.method}
                          className="text-[10px] px-1.5"
                        />
                        <span className="text-sm font-medium text-slate-700 truncate">
                          {result.endpoint.name}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 truncate font-mono mt-0.5">
                        {result.endpoint.path}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.duration !== undefined && (
                        <span className="text-xs text-slate-500 font-mono">
                          {result.duration}ms
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  {result.error && (
                    <div className="mt-2 text-xs text-red-600 truncate pl-9">
                      {result.error}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Test Detail */}
        <ResizablePanel defaultSize={55} minSize={30}>
          {selectedResult ? (
            <ScrollArea className="h-full bg-white">
              <div className="p-4">
                {/* Detail Header */}
                <div className="flex items-center gap-3 mb-4">
                  {getStatusIcon(selectedResult.status)}
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {selectedResult.endpoint.name}
                    </h3>
                    <p className="text-sm text-slate-500 font-mono">
                      {selectedResult.endpoint.path}
                    </p>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Method
                    </span>
                    <div className="mt-1">
                      <MethodBadge method={selectedResult.endpoint.method} />
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Duration
                    </span>
                    <p className="mt-1 text-sm font-mono text-slate-700">
                      {selectedResult.duration !== undefined
                        ? `${selectedResult.duration}ms`
                        : '-'}
                    </p>
                  </div>
                </div>

                {/* Response */}
                {selectedResult.response && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Response
                      </span>
                      <StatusBadge
                        status={selectedResult.response.status}
                        statusText={selectedResult.response.statusText}
                      />
                    </div>
                    <CodeEditor
                      value={JSON.stringify(selectedResult.response.data, null, 2)}
                      language="json"
                      height="300px"
                      readOnly
                    />
                  </div>
                )}

                {/* Error */}
                {selectedResult.error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <span className="text-xs font-medium text-red-600 uppercase tracking-wider">
                      Error
                    </span>
                    <p className="mt-1 text-sm text-red-700 font-mono">
                      {selectedResult.error}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="h-full flex items-center justify-center bg-slate-50">
              <Card className="w-72 text-center border-dashed">
                <CardHeader>
                  <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                    <Layers className="w-5 h-5 text-slate-400" />
                  </div>
                  <CardTitle className="text-base">Select a Test</CardTitle>
                  <CardDescription>
                    Click on a test to view its details
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

