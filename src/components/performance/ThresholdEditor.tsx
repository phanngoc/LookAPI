import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Threshold } from '@/types/performance';
import { cn } from '@/lib/utils';

interface Props {
  thresholds: Threshold[];
  onChange: (thresholds: Threshold[]) => void;
  disabled?: boolean;
}

const METRICS = [
  { value: 'http_req_duration', label: 'Response Time', unit: 'ms' },
  { value: 'error_rate', label: 'Error Rate', unit: '' },
  { value: 'http_req_failed', label: 'Failed Requests', unit: '' },
  { value: 'rps', label: 'Requests/sec', unit: '' },
  { value: 'iterations', label: 'Iterations', unit: '' },
];

const CONDITIONS = {
  http_req_duration: [
    { value: 'p(95)<', label: 'p95 <' },
    { value: 'p(99)<', label: 'p99 <' },
    { value: 'p(90)<', label: 'p90 <' },
    { value: 'avg<', label: 'avg <' },
    { value: 'max<', label: 'max <' },
  ],
  error_rate: [
    { value: 'rate<', label: 'rate <' },
  ],
  http_req_failed: [
    { value: '<', label: '<' },
  ],
  rps: [
    { value: '>', label: '>' },
  ],
  iterations: [
    { value: '>', label: '>' },
  ],
};

const DEFAULT_VALUES: Record<string, string> = {
  http_req_duration: '500',
  error_rate: '0.05',
  http_req_failed: '0.01',
  rps: '100',
  iterations: '1000',
};

export function ThresholdEditor({ thresholds, onChange, disabled }: Props) {
  const handleAddThreshold = () => {
    const newThreshold: Threshold = {
      metric: 'http_req_duration',
      condition: 'p(95)<500',
    };
    onChange([...thresholds, newThreshold]);
  };

  const handleRemoveThreshold = (index: number) => {
    onChange(thresholds.filter((_, i) => i !== index));
  };

  const handleUpdateThreshold = (index: number, metric: string, conditionType: string, value: string) => {
    const updated = thresholds.map((threshold, i) => {
      if (i !== index) return threshold;
      return {
        metric,
        condition: `${conditionType}${value}`,
      };
    });
    onChange(updated);
  };

  const parseCondition = (condition: string): { type: string; value: string } => {
    // Parse conditions like "p(95)<500" or "rate<0.05"
    const match = condition.match(/^([a-z()0-9<>]+)(.*)$/i);
    if (match) {
      return { type: match[1], value: match[2] };
    }
    return { type: 'p(95)<', value: '500' };
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Thresholds</CardTitle>
        <CardDescription className="text-xs">
          Define pass/fail criteria for your test
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {thresholds.map((threshold, index) => {
          const { type, value } = parseCondition(threshold.condition);
          const metricConfig = METRICS.find((m) => m.value === threshold.metric);
          const conditions = CONDITIONS[threshold.metric as keyof typeof CONDITIONS] || CONDITIONS.http_req_duration;

          return (
            <div
              key={index}
              className={cn(
                'flex items-center gap-2 p-3 rounded-lg border bg-slate-50',
                disabled && 'opacity-60'
              )}
            >
              <Select
                value={threshold.metric}
                onValueChange={(newMetric) => {
                  const defaultCond = CONDITIONS[newMetric as keyof typeof CONDITIONS]?.[0]?.value || 'p(95)<';
                  const defaultVal = DEFAULT_VALUES[newMetric] || '500';
                  handleUpdateThreshold(index, newMetric, defaultCond, defaultVal);
                }}
                disabled={disabled}
              >
                <SelectTrigger className="w-36 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRICS.map((metric) => (
                    <SelectItem key={metric.value} value={metric.value}>
                      {metric.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={type}
                onValueChange={(newType) => {
                  handleUpdateThreshold(index, threshold.metric, newType, value);
                }}
                disabled={disabled}
              >
                <SelectTrigger className="w-24 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {conditions.map((cond) => (
                    <SelectItem key={cond.value} value={cond.value}>
                      {cond.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1 flex-1">
                <Input
                  type="text"
                  value={value}
                  onChange={(e) => handleUpdateThreshold(index, threshold.metric, type, e.target.value)}
                  className="w-24 h-8 text-sm"
                  disabled={disabled}
                />
                {metricConfig?.unit && (
                  <span className="text-xs text-slate-500">{metricConfig.unit}</span>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => handleRemoveThreshold(index)}
                disabled={disabled}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          onClick={handleAddThreshold}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Threshold
        </Button>
      </CardContent>
    </Card>
  );
}
