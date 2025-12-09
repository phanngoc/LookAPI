import { useState, useEffect } from 'react';
import { Play, Save, Zap, Activity, TrendingUp, Gauge, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { StageEditor } from './StageEditor';
import { ThresholdEditor } from './ThresholdEditor';
import {
  PerformanceTestConfig,
  PerformanceTestType,
  Stage,
  Threshold,
  getTestTypeDescription,
  createSmokeTestConfig,
  createLoadTestConfig,
  createStressTestConfig,
  createSpikeTestConfig,
  createSoakTestConfig,
} from '@/types/performance';
import { cn } from '@/lib/utils';

interface Props {
  config: PerformanceTestConfig;
  onUpdate: (updates: {
    name?: string;
    testType?: string;
    vus?: number;
    durationSecs?: number;
    iterations?: number;
    stages?: Stage[];
    thresholds?: Threshold[];
  }) => Promise<void>;
  onRun: () => void;
  isUpdating?: boolean;
  isRunning?: boolean;
}

const TEST_TYPES: {
  type: PerformanceTestType;
  icon: React.ReactNode;
  label: string;
  color: string;
}[] = [
  {
    type: 'smoke',
    icon: <Zap className="w-5 h-5" />,
    label: 'Smoke',
    color: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200',
  },
  {
    type: 'load',
    icon: <Activity className="w-5 h-5" />,
    label: 'Load',
    color: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100',
  },
  {
    type: 'stress',
    icon: <TrendingUp className="w-5 h-5" />,
    label: 'Stress',
    color: 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100',
  },
  {
    type: 'spike',
    icon: <Gauge className="w-5 h-5" />,
    label: 'Spike',
    color: 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100',
  },
  {
    type: 'soak',
    icon: <Timer className="w-5 h-5" />,
    label: 'Soak',
    color: 'bg-teal-50 text-teal-600 border-teal-200 hover:bg-teal-100',
  },
];

export function ConfigForm({ config, onUpdate, onRun, isUpdating, isRunning }: Props) {
  const [name, setName] = useState(config.name);
  const [testType, setTestType] = useState<PerformanceTestType>(config.testType);
  const [vus, setVus] = useState(config.vus || 10);
  const [durationSecs, setDurationSecs] = useState(config.durationSecs || 60);
  const [stages, setStages] = useState<Stage[]>(config.stages || []);
  const [thresholds, setThresholds] = useState<Threshold[]>(config.thresholds || []);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setName(config.name);
    setTestType(config.testType);
    setVus(config.vus || 10);
    setDurationSecs(config.durationSecs || 60);
    setStages(config.stages || []);
    setThresholds(config.thresholds || []);
    setHasChanges(false);
  }, [config]);

  const handleTestTypeChange = (newType: PerformanceTestType) => {
    setTestType(newType);
    setHasChanges(true);

    // Apply default config for the selected test type
    const defaultConfig = getDefaultConfig(newType);
    if (defaultConfig.stages) {
      setStages(defaultConfig.stages);
    }
    if (defaultConfig.thresholds) {
      setThresholds(defaultConfig.thresholds);
    }
    if (defaultConfig.vus) {
      setVus(defaultConfig.vus);
    }
    if (defaultConfig.durationSecs) {
      setDurationSecs(defaultConfig.durationSecs);
    }
  };

  const getDefaultConfig = (type: PerformanceTestType) => {
    const scenarioId = config.scenarioId;
    switch (type) {
      case 'smoke':
        return createSmokeTestConfig(scenarioId, name);
      case 'load':
        return createLoadTestConfig(scenarioId, name);
      case 'stress':
        return createStressTestConfig(scenarioId, name);
      case 'spike':
        return createSpikeTestConfig(scenarioId, name);
      case 'soak':
        return createSoakTestConfig(scenarioId, name);
      default:
        return createLoadTestConfig(scenarioId, name);
    }
  };

  const handleSave = async () => {
    await onUpdate({
      name,
      testType,
      vus: testType === 'smoke' ? vus : undefined,
      durationSecs: testType === 'smoke' ? durationSecs : undefined,
      stages: testType !== 'smoke' ? stages : undefined,
      thresholds,
    });
    setHasChanges(false);
  };

  const useStages = testType !== 'smoke';

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{config.name}</h3>
            <p className="text-xs text-slate-500">{getTestTypeDescription(testType)}</p>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={isUpdating}
              >
                <Save className="w-4 h-4 mr-1.5" />
                {isUpdating ? 'Saving...' : 'Save'}
              </Button>
            )}
            <Button size="sm" onClick={onRun} disabled={isRunning || hasChanges}>
              <Play className="w-4 h-4 mr-1.5" />
              {isRunning ? 'Starting...' : 'Run Test'}
            </Button>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">
              Test Name
            </label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Enter test name"
            />
          </div>

          <Separator />

          {/* Test Type Selector */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-2 block">
              Test Type
            </label>
            <div className="grid grid-cols-5 gap-2">
              {TEST_TYPES.map((tt) => (
                <button
                  key={tt.type}
                  onClick={() => handleTestTypeChange(tt.type)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all',
                    testType === tt.type
                      ? `${tt.color} ring-2 ring-offset-1`
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                  )}
                >
                  {tt.icon}
                  <span className="text-xs font-medium">{tt.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {getTestTypeDescription(testType)}
            </p>
          </div>

          <Separator />

          {/* Simple VUs/Duration (for Smoke test) or Stages (for others) */}
          {useStages ? (
            <StageEditor
              stages={stages}
              onChange={(newStages) => {
                setStages(newStages);
                setHasChanges(true);
              }}
            />
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Test Parameters</CardTitle>
                <CardDescription className="text-xs">
                  Configure virtual users and duration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                      Virtual Users (VUs)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={vus}
                      onChange={(e) => {
                        setVus(parseInt(e.target.value) || 1);
                        setHasChanges(true);
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                      Duration (seconds)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={durationSecs}
                      onChange={(e) => {
                        setDurationSecs(parseInt(e.target.value) || 1);
                        setHasChanges(true);
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Thresholds */}
          <ThresholdEditor
            thresholds={thresholds}
            onChange={(newThresholds) => {
              setThresholds(newThresholds);
              setHasChanges(true);
            }}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
