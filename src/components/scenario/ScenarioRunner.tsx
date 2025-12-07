import { useState, useEffect } from 'react';
import {
  Play,
  Edit2,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Send,
  GitBranch,
  Repeat,
  Code,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useTestScenarioRuns, useTestScenarioSteps } from '@/hooks/useTestScenarios';
import { useTestScenarioProgress } from '@/hooks/useTestScenarioProgress';
import { ScenarioProgressBar } from './ScenarioProgressBar';
import { CodeEditor } from '@/components/shared/CodeEditor';
import {
  TestScenario,
  TestStepType,
  StepResultStatus,
  ScenarioRunStatus,
} from '@/types/scenario';
import { cn } from '@/lib/utils';

interface Props {
  scenario: TestScenario;
  onEditClick: () => void;
}

const STEP_TYPE_ICONS: Record<TestStepType, React.ReactNode> = {
  request: <Send className="w-4 h-4" />,
  condition: <GitBranch className="w-4 h-4" />,
  loop: <Repeat className="w-4 h-4" />,
  delay: <Clock className="w-4 h-4" />,
  script: <Code className="w-4 h-4" />,
};

export function ScenarioRunner({ scenario, onEditClick }: Props) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const { steps } = useTestScenarioSteps(scenario.id);
  const { runScenario, isRunning, lastRun, refetch } = useTestScenarioRuns(scenario.id);
  const { progress, reset } = useTestScenarioProgress(scenario.id);

  // Use real-time progress if available, otherwise fall back to lastRun
  const displayRun = progress.finalRun || lastRun;
  const isCurrentlyRunning = progress.isRunning || isRunning;

  // Get enabled steps sorted by order
  const enabledSteps = (steps || [])
    .filter((s) => s.enabled)
    .sort((a, b) => a.stepOrder - b.stepOrder);

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const handleRun = async () => {
    try {
      reset(); // Reset progress state
      await runScenario();
      refetch();
    } catch (e) {
      console.error('Failed to run scenario:', e);
    }
  };

  const getStatusIcon = (status: StepResultStatus | ScenarioRunStatus) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'failed':
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'skipped':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: ScenarioRunStatus) => {
    const colors: Record<ScenarioRunStatus, string> = {
      pending: 'bg-slate-100 text-slate-600',
      running: 'bg-blue-100 text-blue-600',
      passed: 'bg-emerald-100 text-emerald-600',
      failed: 'bg-red-100 text-red-600',
      stopped: 'bg-amber-100 text-amber-600',
      error: 'bg-red-100 text-red-600',
    };

    return (
      <Badge variant="outline" className={cn('text-xs', colors[status])}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-slate-900">{scenario.name}</h3>
            {displayRun && !isCurrentlyRunning && getStatusBadge(displayRun.status)}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onEditClick}>
              <Edit2 className="w-4 h-4 mr-1.5" />
              Edit
            </Button>
            <Button size="sm" onClick={handleRun} disabled={isCurrentlyRunning}>
              {isCurrentlyRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1.5" />
                  Run
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Progress Bar - Show when running or when there's progress */}
        {(isCurrentlyRunning || progress.progressPercentage > 0) && (
          <div className="mt-3">
            <ScenarioProgressBar
              progressPercentage={progress.progressPercentage}
              currentStepIndex={progress.currentStepIndex}
              totalSteps={progress.totalSteps || 0}
              elapsedTime={progress.elapsedTime}
              isRunning={isCurrentlyRunning}
            />
          </div>
        )}

        {/* Progress Summary - Show when completed */}
        {displayRun && !isCurrentlyRunning && (
          <div className="mt-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              {getStatusIcon(displayRun.status)}
              <span className="font-medium text-slate-700">
                {displayRun.status === 'passed'
                  ? 'All steps passed'
                  : `${displayRun.failedSteps} of ${displayRun.totalSteps} failed`}
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-500">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {displayRun.passedSteps}
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5 text-red-500" />
                {displayRun.failedSteps}
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                {displayRun.skippedSteps}
              </span>
              {displayRun.durationMs && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {displayRun.durationMs}ms
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {!displayRun && !isCurrentlyRunning ? (
            <Card className="border-dashed">
              <CardHeader className="text-center">
                <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                  <Play className="w-5 h-5 text-slate-400" />
                </div>
                <CardTitle className="text-base">No Results Yet</CardTitle>
                <p className="text-sm text-slate-500">
                  Click "Run" to execute the test scenario
                </p>
              </CardHeader>
            </Card>
          ) : (
            enabledSteps.map((step, index) => {
              // Get result from real-time progress or final run
              const result = isCurrentlyRunning
                ? progress.stepResults.get(step.id)
                : displayRun?.results.find((r) => r.stepId === step.id);

              const isCurrentStep = isCurrentlyRunning && index === progress.currentStepIndex;
              const stepStatus: StepResultStatus = result
                ? result.status
                : isCurrentStep
                ? 'running'
                : 'pending';

              return (
                <Collapsible
                  key={step.id}
                  open={expandedSteps.has(step.id)}
                  onOpenChange={() => toggleStep(step.id)}
                >
                  <Card
                    className={cn(
                      'transition-all duration-300 ease-in-out mb-3',
                      stepStatus === 'failed' && 'border-red-200 bg-red-50/30',
                      stepStatus === 'passed' && 'border-emerald-200 bg-emerald-50/30',
                      stepStatus === 'running' && 'border-blue-200 bg-blue-50/30 shadow-md',
                      stepStatus === 'pending' && 'border-slate-200'
                    )}
                  >
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-6 h-6 rounded bg-slate-100">
                            <span className="text-xs font-medium text-slate-600">
                              {index + 1}
                            </span>
                          </div>
                          <div className={cn(
                            'transition-all duration-300',
                            stepStatus === 'running' && 'animate-pulse'
                          )}>
                            {getStatusIcon(stepStatus)}
                          </div>
                          <div
                            className={cn(
                              'flex items-center justify-center w-7 h-7 rounded transition-all duration-300',
                              step.stepType === 'request' && 'bg-blue-100 text-blue-600',
                              step.stepType === 'delay' && 'bg-slate-100 text-slate-600',
                              step.stepType === 'script' && 'bg-emerald-100 text-emerald-600',
                              stepStatus === 'running' && 'scale-110'
                            )}
                          >
                            {STEP_TYPE_ICONS[step.stepType]}
                          </div>
                          <div className="flex-1 text-left">
                            <div className="text-sm font-medium text-slate-900">
                              {step.name}
                            </div>
                            {result?.durationMs && (
                              <div className="text-xs text-slate-500">
                                {result.durationMs}ms
                              </div>
                            )}
                            {stepStatus === 'running' && (
                              <div className="text-xs text-blue-600 animate-pulse">
                                Running...
                              </div>
                            )}
                          </div>
                          {expandedSteps.has(step.id) ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    {result && (
                      <CollapsibleContent>
                        <CardContent className="pt-0 space-y-3">
                          {/* Error */}
                          {result.error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                              <p className="text-sm text-red-700 font-medium">Error</p>
                              <p className="text-xs text-red-600 mt-1">{result.error}</p>
                            </div>
                          )}

                          {/* Request */}
                          {result.request && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="bg-blue-50 text-blue-700 border-blue-200"
                                >
                                  {result.request.method} {result.request.url}
                                </Badge>
                              </div>
                              <div className="rounded-lg border overflow-hidden">
                                <div className="bg-slate-50 px-3 py-1.5 border-b">
                                  <span className="text-xs font-medium text-slate-600">
                                    Request Body
                                  </span>
                                </div>
                                <div className="max-h-48 overflow-auto">
                                  <CodeEditor
                                    value={
                                      result.request.body
                                        ? JSON.stringify(result.request.body, null, 2)
                                        : '{}'
                                    }
                                    language="json"
                                    readOnly
                                    height="150px"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Response */}
                          {result.response && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    result.response.status >= 200 && result.response.status < 300
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : result.response.status >= 400
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  )}
                                >
                                  {result.response.status} {result.response.statusText}
                                </Badge>
                                <span className="text-xs text-slate-500">
                                  {result.response.durationMs}ms
                                </span>
                              </div>
                              <div className="rounded-lg border overflow-hidden">
                                <div className="bg-slate-50 px-3 py-1.5 border-b">
                                  <span className="text-xs font-medium text-slate-600">
                                    Response Body
                                  </span>
                                </div>
                                <div className="max-h-48 overflow-auto">
                                  <CodeEditor
                                    value={JSON.stringify(result.response.body, null, 2)}
                                    language="json"
                                    readOnly
                                    height="150px"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Assertions */}
                          {result.assertions && result.assertions.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-slate-600">Assertions</p>
                              {result.assertions.map((assertion, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    'p-2 rounded-lg border text-sm',
                                    assertion.passed
                                      ? 'bg-emerald-50 border-emerald-200'
                                      : 'bg-red-50 border-red-200'
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    {assertion.passed ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-red-500" />
                                    )}
                                    <span className="font-medium">
                                      {assertion.name || `${assertion.source} ${assertion.operator}`}
                                    </span>
                                  </div>
                                  {assertion.error && (
                                    <p className="text-xs text-red-600 mt-1 ml-6">
                                      {assertion.error}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Extracted Variables */}
                          {result.extractedVariables &&
                            Object.keys(result.extractedVariables).length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-slate-600">
                                  Extracted Variables
                                </p>
                                <div className="p-2 bg-slate-50 rounded-lg space-y-1">
                                  {Object.entries(result.extractedVariables).map(([key, value]) => (
                                    <div key={key} className="flex items-center gap-2 text-xs">
                                      <code className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">
                                        {key}
                                      </code>
                                      <span className="text-slate-400">=</span>
                                      <code className="text-slate-600 truncate">
                                        {typeof value === 'string'
                                          ? value
                                          : JSON.stringify(value)}
                                      </code>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                        </CardContent>
                      </CollapsibleContent>
                    )}
                  </Card>
                </Collapsible>
              );
            })
          )}

          {/* Variables Summary */}
          {displayRun && Object.keys(displayRun.variables).length > 0 && (
            <>
              <Separator />
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Final Variables State</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="p-2 bg-slate-50 rounded-lg space-y-1">
                    {Object.entries(displayRun.variables).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <code className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">
                          {key}
                        </code>
                        <span className="text-slate-400">=</span>
                        <code className="text-slate-600 truncate max-w-xs">
                          {typeof value === 'string' ? value : JSON.stringify(value)}
                        </code>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

