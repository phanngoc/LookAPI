import { 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Clock, 
  Users, 
  Activity,
  AlertTriangle,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ReportExporter } from './ReportExporter';
import { 
  PerformanceTestRun, 
  PerformanceTestConfig, 
  formatDuration,
  formatErrorRate,
} from '@/types/performance';
import { cn } from '@/lib/utils';

interface Props {
  run: PerformanceTestRun;
  config: PerformanceTestConfig;
  onRunAgain: () => void;
  onReset: () => void;
  isRunning?: boolean;
}

export function ResultsView({ run, config, onRunAgain, onReset, isRunning }: Props) {
  const isPassed = run.status === 'passed';
  const metrics = run.metrics;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isPassed ? (
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
            )}
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Test Results: {config.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Badge variant={isPassed ? 'success' : 'destructive'}>
                  {run.status.toUpperCase()}
                </Badge>
                <span>Started: {formatDate(run.startedAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onReset}>
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Back to Config
            </Button>
            <Button size="sm" onClick={onRunAgain} disabled={isRunning}>
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Run Again
            </Button>
            <ReportExporter run={run} config={config} />
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className={cn(
        'px-4 py-3 border-b',
        isPassed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-600">
                Duration: <strong>{run.durationMs ? formatDuration(run.durationMs) : 'N/A'}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-600">
                Max VUs: <strong>{run.maxVusReached}</strong>
              </span>
            </div>
          </div>
          {run.errorMessage && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{run.errorMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Summary Metrics */}
          {metrics && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Summary Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-4">
                    <MetricCard
                      label="Total Requests"
                      value={metrics.totalRequests.toLocaleString()}
                      icon={<Activity className="w-4 h-4" />}
                      color="text-blue-600"
                      bgColor="bg-blue-50"
                    />
                    <MetricCard
                      label="Failed Requests"
                      value={metrics.failedRequests.toLocaleString()}
                      icon={<XCircle className="w-4 h-4" />}
                      color={metrics.failedRequests > 0 ? 'text-red-600' : 'text-slate-600'}
                      bgColor={metrics.failedRequests > 0 ? 'bg-red-50' : 'bg-slate-50'}
                    />
                    <MetricCard
                      label="Requests/sec"
                      value={metrics.requestsPerSecond.toFixed(1)}
                      icon={<Zap className="w-4 h-4" />}
                      color="text-purple-600"
                      bgColor="bg-purple-50"
                    />
                    <MetricCard
                      label="Error Rate"
                      value={formatErrorRate(metrics.errorRate)}
                      icon={<AlertTriangle className="w-4 h-4" />}
                      color={metrics.errorRate > 0.05 ? 'text-red-600' : 'text-amber-600'}
                      bgColor={metrics.errorRate > 0.05 ? 'bg-red-50' : 'bg-amber-50'}
                    />
                    <MetricCard
                      label="Iterations"
                      value={metrics.iterationsCompleted.toLocaleString()}
                      icon={<TrendingUp className="w-4 h-4" />}
                      color="text-emerald-600"
                      bgColor="bg-emerald-50"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Response Time Distribution */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Response Time Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-3 mb-4">
                    <LatencyMetric label="Min" value={metrics.durationMin} />
                    <LatencyMetric label="Avg" value={Math.round(metrics.durationAvg)} />
                    <LatencyMetric label="Med (P50)" value={metrics.durationMed} highlight />
                    <LatencyMetric label="P90" value={metrics.durationP90} />
                    <LatencyMetric label="P95" value={metrics.durationP95} highlight />
                    <LatencyMetric label="P99" value={metrics.durationP99} />
                    <LatencyMetric label="Max" value={metrics.durationMax} />
                  </div>
                  
                  {/* Simple Distribution Bar */}
                  <DistributionBar metrics={metrics} />
                </CardContent>
              </Card>
            </>
          )}

          {/* Threshold Results */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Threshold Results</CardTitle>
              <CardDescription className="text-xs">
                {run.thresholdResults.filter(r => r.passed).length} of {run.thresholdResults.length} thresholds passed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {run.thresholdResults.map((result, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border',
                    result.passed
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-red-50 border-red-200'
                  )}
                >
                  {result.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900">
                      {result.threshold.metric} {result.threshold.condition}
                    </div>
                    <div className="text-xs text-slate-600">
                      {result.message}
                    </div>
                  </div>
                  <Badge variant={result.passed ? 'success' : 'destructive'}>
                    {result.passed ? 'Pass' : 'Fail'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Per-Step Breakdown */}
          {metrics?.stepMetrics && Object.keys(metrics.stepMetrics).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Per-Step Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Step</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Requests</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Failed</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Avg</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">P95</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Error Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(metrics.stepMetrics).map(([stepName, sm]) => (
                        <tr key={stepName} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-medium text-slate-900">{stepName}</td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {sm.totalRequests.toLocaleString()}
                          </td>
                          <td className={cn(
                            'px-4 py-3 text-right',
                            sm.failedRequests > 0 ? 'text-red-600' : 'text-slate-600'
                          )}>
                            {sm.failedRequests}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {sm.durationAvg.toFixed(0)}ms
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {sm.durationP95}ms
                          </td>
                          <td className={cn(
                            'px-4 py-3 text-right',
                            sm.errorRate > 0.05 ? 'text-red-600' : 'text-slate-600'
                          )}>
                            {formatErrorRate(sm.errorRate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Helper Components

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

function MetricCard({ label, value, icon, color, bgColor }: MetricCardProps) {
  return (
    <div className={cn('p-3 rounded-lg border border-slate-200', bgColor)}>
      <div className={cn('flex items-center gap-2 mb-1', color)}>
        {icon}
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className={cn('text-lg font-bold', color)}>{value}</div>
    </div>
  );
}

interface LatencyMetricProps {
  label: string;
  value: number;
  highlight?: boolean;
}

function LatencyMetric({ label, value, highlight }: LatencyMetricProps) {
  return (
    <div className={cn(
      'text-center p-2 rounded',
      highlight ? 'bg-blue-50' : 'bg-slate-50'
    )}>
      <div className={cn(
        'text-lg font-bold',
        highlight ? 'text-blue-600' : 'text-slate-900'
      )}>
        {value}ms
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

interface DistributionBarProps {
  metrics: {
    durationMin: number;
    durationP90: number;
    durationP95: number;
    durationP99: number;
    durationMax: number;
  };
}

function DistributionBar({ metrics }: DistributionBarProps) {
  const max = metrics.durationMax || 1;
  
  const getWidth = (value: number) => {
    return Math.min((value / max) * 100, 100);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="w-12 text-slate-500">P95:</span>
        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full"
            style={{ width: `${getWidth(metrics.durationP95)}%` }}
          />
        </div>
        <span className="w-16 text-right text-slate-600">{metrics.durationP95}ms</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="w-12 text-slate-500">P99:</span>
        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full"
            style={{ width: `${getWidth(metrics.durationP99)}%` }}
          />
        </div>
        <span className="w-16 text-right text-slate-600">{metrics.durationP99}ms</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="w-12 text-slate-500">Max:</span>
        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 rounded-full"
            style={{ width: '100%' }}
          />
        </div>
        <span className="w-16 text-right text-slate-600">{metrics.durationMax}ms</span>
      </div>
    </div>
  );
}
