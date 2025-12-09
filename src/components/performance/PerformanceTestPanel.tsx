import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { ConfigList } from './ConfigList';
import { ConfigForm } from './ConfigForm';
import { TestRunner } from './TestRunner';
import { ResultsView } from './ResultsView';
import { useScenarioPerformanceTest, usePerformanceTest } from '@/hooks/usePerformanceTest';
import {
  PerformanceTestConfig,
  createSmokeTestConfig,
} from '@/types/performance';

interface Props {
  scenarioId: string;
}

type ViewState = 'empty' | 'config' | 'running' | 'results';

export function PerformanceTestPanel({ scenarioId }: Props) {
  const [selectedConfig, setSelectedConfig] = useState<PerformanceTestConfig | null>(null);
  const [viewState, setViewState] = useState<ViewState>('empty');

  const {
    configs,
    isLoadingConfigs,
    createConfig,
    deleteConfig,
    isCreating,
    isDeleting,
    runTest,
    isRunning,
    progress,
    completedRun,
    resetProgress,
  } = useScenarioPerformanceTest(scenarioId);

  // Get update function for selected config
  const { updateConfig, isUpdating } = usePerformanceTest(selectedConfig?.id || '');

  // Update view state based on progress/completedRun
  useEffect(() => {
    if (progress.isRunning) {
      setViewState('running');
    } else if (completedRun && selectedConfig) {
      setViewState('results');
    }
  }, [progress.isRunning, completedRun, selectedConfig]);

  // Reset selected config when it's deleted
  useEffect(() => {
    if (selectedConfig && !configs.find((c) => c.id === selectedConfig.id)) {
      setSelectedConfig(null);
      setViewState('empty');
    }
  }, [configs, selectedConfig]);

  // Auto-select first config if none selected
  useEffect(() => {
    if (!selectedConfig && configs.length > 0 && !isLoadingConfigs) {
      setSelectedConfig(configs[0]);
      setViewState('config');
    }
  }, [configs, selectedConfig, isLoadingConfigs]);

  const handleCreate = async (name: string) => {
    const input = createSmokeTestConfig(scenarioId, name);
    const newConfig = await createConfig(input);
    setSelectedConfig(newConfig);
    setViewState('config');
  };

  const handleSelect = (config: PerformanceTestConfig) => {
    setSelectedConfig(config);
    resetProgress();
    setViewState('config');
  };

  const handleDelete = async (id: string) => {
    await deleteConfig(id);
    if (selectedConfig?.id === id) {
      setSelectedConfig(null);
      setViewState('empty');
    }
  };

  const handleRun = async () => {
    if (!selectedConfig) return;
    resetProgress();
    setViewState('running');
    try {
      await runTest(selectedConfig.id);
    } catch (e) {
      console.error('Failed to run test:', e);
      setViewState('config');
    }
  };

  const handleReset = () => {
    resetProgress();
    setViewState('config');
  };

  const handleRunAgain = () => {
    handleRun();
  };

  const renderMainContent = () => {
    if (!selectedConfig) {
      return (
        <div className="h-full flex items-center justify-center bg-slate-50">
          <Card className="w-80 text-center border-dashed">
            <CardHeader>
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                <Activity className="w-6 h-6 text-slate-400" />
              </div>
              <CardTitle className="text-base">Select a Test Configuration</CardTitle>
              <CardDescription>
                Select or create a performance test to get started
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      );
    }

    switch (viewState) {
      case 'running':
        return (
          <TestRunner
            config={selectedConfig}
            progress={progress}
            onStop={() => {
              // TODO: Implement stop functionality when backend supports it
              resetProgress();
              setViewState('config');
            }}
          />
        );

      case 'results':
        if (!completedRun) {
          return (
            <ConfigForm
              config={selectedConfig}
              onUpdate={updateConfig}
              onRun={handleRun}
              isUpdating={isUpdating}
              isRunning={isRunning}
            />
          );
        }
        return (
          <ResultsView
            run={completedRun}
            config={selectedConfig}
            onRunAgain={handleRunAgain}
            onReset={handleReset}
            isRunning={isRunning}
          />
        );

      case 'config':
      default:
        return (
          <ConfigForm
            config={selectedConfig}
            onUpdate={updateConfig}
            onRun={handleRun}
            isUpdating={isUpdating}
            isRunning={isRunning}
          />
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="px-4 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-100">
            <Activity className="w-4 h-4 text-orange-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">Performance Testing</h2>
            <p className="text-sm text-slate-500">
              Test API performance with virtual users
            </p>
          </div>
        </div>

        {selectedConfig && viewState === 'running' && (
          <>
            <Separator className="my-3" />
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="font-medium text-slate-700">
                  Running: {selectedConfig.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <span>{progress.currentVus} VUs</span>
                <span>•</span>
                <span>{progress.totalRequests.toLocaleString()} requests</span>
                <span>•</span>
                <span>{progress.rps.toFixed(1)} RPS</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Config List */}
        <ResizablePanel defaultSize={35} minSize={25}>
          <ConfigList
            configs={configs}
            selectedConfig={selectedConfig}
            onSelect={handleSelect}
            onCreate={handleCreate}
            onDelete={handleDelete}
            isCreating={isCreating}
            isDeleting={isDeleting}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Main Panel */}
        <ResizablePanel defaultSize={65} minSize={40}>
          {renderMainContent()}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
