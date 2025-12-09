import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Stage } from '@/types/performance';
import { cn } from '@/lib/utils';

interface Props {
  stages: Stage[];
  onChange: (stages: Stage[]) => void;
  disabled?: boolean;
}

export function StageEditor({ stages, onChange, disabled }: Props) {
  const handleAddStage = () => {
    const lastStage = stages[stages.length - 1];
    const newStage: Stage = {
      durationSecs: 60,
      targetVus: lastStage?.targetVus || 10,
    };
    onChange([...stages, newStage]);
  };

  const handleRemoveStage = (index: number) => {
    onChange(stages.filter((_, i) => i !== index));
  };

  const handleUpdateStage = (index: number, field: keyof Stage, value: number) => {
    const updated = stages.map((stage, i) =>
      i === index ? { ...stage, [field]: value } : stage
    );
    onChange(updated);
  };

  // Calculate total duration for preview
  const totalDurationSecs = stages.reduce((sum, s) => sum + s.durationSecs, 0);
  const maxVus = Math.max(...stages.map((s) => s.targetVus), 0);

  // Generate points for the stage preview chart
  const generateChartPoints = () => {
    if (stages.length === 0) return '';
    
    const points: { x: number; y: number }[] = [];
    let currentTime = 0;
    let currentVus = 0;

    // Starting point
    points.push({ x: 0, y: 0 });

    stages.forEach((stage) => {
      // End of this stage
      currentTime += stage.durationSecs;
      points.push({
        x: (currentTime / totalDurationSecs) * 100,
        y: ((maxVus - stage.targetVus) / maxVus) * 100,
      });
      currentVus = stage.targetVus;
    });

    return points.map((p) => `${p.x},${p.y}`).join(' ');
  };

  const formatDuration = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Stages Configuration</CardTitle>
        <CardDescription className="text-xs">
          Configure how VUs ramp up and down over time
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stages List */}
        <div className="space-y-2">
          {stages.map((stage, index) => (
            <div
              key={index}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border bg-slate-50',
                disabled && 'opacity-60'
              )}
            >
              <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
              
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span className="font-medium">Stage {index + 1}</span>
              </div>

              <div className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500">Duration:</span>
                  <Input
                    type="number"
                    min={1}
                    value={stage.durationSecs}
                    onChange={(e) =>
                      handleUpdateStage(index, 'durationSecs', parseInt(e.target.value) || 1)
                    }
                    className="w-20 h-8 text-sm"
                    disabled={disabled}
                  />
                  <span className="text-xs text-slate-500">s</span>
                </div>

                <span className="text-slate-400">→</span>

                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500">Target VUs:</span>
                  <Input
                    type="number"
                    min={0}
                    value={stage.targetVus}
                    onChange={(e) =>
                      handleUpdateStage(index, 'targetVus', parseInt(e.target.value) || 0)
                    }
                    className="w-20 h-8 text-sm"
                    disabled={disabled}
                  />
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => handleRemoveStage(index)}
                disabled={disabled || stages.length <= 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleAddStage}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Stage
        </Button>

        {/* Visual Preview */}
        {stages.length > 0 && totalDurationSecs > 0 && maxVus > 0 && (
          <div className="mt-4 p-3 bg-slate-100 rounded-lg">
            <div className="text-xs font-medium text-slate-600 mb-2">
              Preview (Total: {formatDuration(totalDurationSecs)}, Max: {maxVus} VUs)
            </div>
            <div className="relative h-24 bg-white rounded border">
              {/* Y-axis labels */}
              <div className="absolute left-1 top-0 text-[10px] text-slate-400">{maxVus}</div>
              <div className="absolute left-1 bottom-0 text-[10px] text-slate-400">0</div>
              
              {/* Chart */}
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full"
              >
                <polyline
                  points={`0,100 ${generateChartPoints()}`}
                  fill="none"
                  stroke="rgb(59, 130, 246)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
                <polyline
                  points={`0,100 ${generateChartPoints()} 100,100`}
                  fill="rgba(59, 130, 246, 0.1)"
                  stroke="none"
                />
              </svg>
            </div>
            
            {/* X-axis labels */}
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>0</span>
              <span>{formatDuration(totalDurationSecs)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
