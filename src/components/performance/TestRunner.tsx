import { Square, Users, Activity, AlertTriangle, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { PerformanceProgress } from '@/hooks/usePerformanceTest';
import { PerformanceTestConfig, formatDuration } from '@/types/performance';
import { cn } from '@/lib/utils';

interface Props {
  config: PerformanceTestConfig;
  progress: PerformanceProgress;
  onStop?: () => void;
}

export function TestRunner({ config, progress, onStop }: Props) {
  // Calculate total duration and progress percentage
  const getTotalDuration = () => {
    if (config.stages && config.stages.length > 0) {
      return config.stages.reduce((sum, s) => sum + s.durationSecs, 0);
    }
    return config.durationSecs || 60;
  };

  const totalDuration = getTotalDuration();
  const progressPercent = Math.min((progress.elapsedSecs / totalDuration) * 100, 100);

  // Format elapsed time
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Get stage info
  const getStageInfo = () => {
    if (!config.stages || config.stages.length === 0) return null;
    const currentIdx = progress.currentStage?.index ?? 0;
    return {
      current: currentIdx + 1,
      total: config.stages.length,
      targetVus: progress.currentStage?.targetVus ?? config.stages[0]?.targetVus ?? 0,
    };
  };

  const stageInfo = getStageInfo();

  // Metric cards data
  const metrics = [
    {
      label: 'Current VUs',
      value: progress.currentVus.toString(),
      icon: <Users className="w-4 h-4" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Total Requests',
      value: progress.totalRequests.toLocaleString(),
      icon: <Activity className="w-4 h-4" />,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'RPS',
      value: progress.rps.toFixed(1),
      icon: <Zap className="w-4 h-4" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      label: 'Error Rate',
      value: `${(progress.errorRate * 100).toFixed(2)}%`,
      icon: <AlertTriangle className="w-4 h-4" />,
      color: progress.errorRate > 0.05 ? 'text-red-600' : 'text-amber-600',
      bgColor: progress.errorRate > 0.05 ? 'bg-red-50' : 'bg-amber-50',
    },
    {
      label: 'P95 Latency',
      value: `${progress.p95Duration}ms`,
      icon: <Clock className="w-4 h-4" />,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50',
    },
  ];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
              <div className="absolute inset-0 w-3 h-3 bg-blue-500 rounded-full animate-ping" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Running: {config.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Badge variant="secondary">{config.testType}</Badge>
                {stageInfo && (
                  <span>Stage {stageInfo.current} of {stageInfo.total}</span>
                )}
              </div>
            </div>
          </div>
          {onStop && (
            <Button variant="destructive" size="sm" onClick={onStop}>
              <Square className="w-4 h-4 mr-1.5" />
              Stop
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-slate-600">Progress</span>
          <span className="text-slate-900 font-medium">
            {formatTime(progress.elapsedSecs)} / {formatTime(totalDuration)}
          </span>
        </div>
        <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
          <span>{progressPercent.toFixed(1)}%</span>
          {stageInfo && (
            <span>Target: {stageInfo.targetVus} VUs</span>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Metrics Grid */}
          <div className="grid grid-cols-5 gap-3">
            {metrics.map((metric) => (
              <Card key={metric.label} className="border-slate-200">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn('p-1 rounded', metric.bgColor, metric.color)}>
                      {metric.icon}
                    </div>
                    <span className="text-xs text-slate-500">{metric.label}</span>
                  </div>
                  <div className={cn('text-xl font-bold', metric.color)}>
                    {metric.value}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Separator />

          {/* VU Ramping Chart */}
          {config.stages && config.stages.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">VU Ramping</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative h-32 bg-slate-50 rounded-lg p-2">
                  <VURampingChart
                    stages={config.stages}
                    currentTime={progress.elapsedSecs}
                    currentVus={progress.currentVus}
                    totalDuration={totalDuration}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Requests */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Recent Requests</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {progress.recentRequests.length} requests
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-48 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">VU</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Step</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Status</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.recentRequests.slice(-20).reverse().map((req, idx) => (
                      <tr
                        key={idx}
                        className={cn(
                          'border-t border-slate-100',
                          !req.success && 'bg-red-50'
                        )}
                      >
                        <td className="px-3 py-2 text-slate-600">#{req.vuId}</td>
                        <td className="px-3 py-2 text-slate-900 font-medium truncate max-w-[150px]">
                          {req.stepName}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={req.success ? 'success' : 'destructive'}
                            className="text-xs"
                          >
                            {req.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {req.durationMs}ms
                        </td>
                      </tr>
                    ))}
                    {progress.recentRequests.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                          Waiting for requests...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Iterations */}
          <div className="flex items-center justify-between text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
            <span>Iterations Completed</span>
            <span className="font-medium text-slate-900">
              {progress.iterationsCompleted.toLocaleString()}
            </span>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// VU Ramping Chart Component
interface VURampingChartProps {
  stages: { durationSecs: number; targetVus: number }[];
  currentTime: number;
  currentVus: number;
  totalDuration: number;
}

function VURampingChart({ stages, currentTime, currentVus, totalDuration }: VURampingChartProps) {
  const maxVus = Math.max(...stages.map((s) => s.targetVus), 1);

  // Generate planned line points
  const generatePlannedPoints = () => {
    const points: string[] = ['0,100'];
    let time = 0;
    let prevVus = 0;

    stages.forEach((stage) => {
      time += stage.durationSecs;
      const x = (time / totalDuration) * 100;
      const y = 100 - (stage.targetVus / maxVus) * 100;
      points.push(`${x},${y}`);
      prevVus = stage.targetVus;
    });

    return points.join(' ');
  };

  // Current position
  const currentX = (currentTime / totalDuration) * 100;
  const currentY = 100 - (currentVus / maxVus) * 100;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
      {/* Grid lines */}
      <line x1="0" y1="50" x2="100" y2="50" stroke="#e2e8f0" strokeWidth="0.5" />
      <line x1="0" y1="0" x2="100" y2="0" stroke="#e2e8f0" strokeWidth="0.5" />
      <line x1="0" y1="100" x2="100" y2="100" stroke="#e2e8f0" strokeWidth="0.5" />

      {/* Planned line */}
      <polyline
        points={generatePlannedPoints()}
        fill="none"
        stroke="#cbd5e1"
        strokeWidth="2"
        strokeDasharray="4,4"
        vectorEffect="non-scaling-stroke"
      />

      {/* Actual progress line */}
      <polyline
        points={`0,100 ${currentX},${currentY}`}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />

      {/* Current position dot */}
      <circle
        cx={currentX}
        cy={currentY}
        r="3"
        fill="#3b82f6"
        vectorEffect="non-scaling-stroke"
      />

      {/* Labels */}
      <text x="2" y="8" fontSize="8" fill="#64748b">{maxVus}</text>
      <text x="2" y="98" fontSize="8" fill="#64748b">0</text>
    </svg>
  );
}
