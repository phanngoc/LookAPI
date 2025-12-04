import { useState } from 'react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { ScenarioList } from './ScenarioList';
import { ScenarioEditor } from './ScenarioEditor';
import { ScenarioRunner } from './ScenarioRunner';
import { TestScenario } from '@/types/scenario';
import { FlaskConical } from 'lucide-react';

interface Props {
  projectId: string;
}

export function ScenarioPanel({ projectId }: Props) {
  const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(null);
  const [mode, setMode] = useState<'edit' | 'run'>('edit');

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="px-4 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100">
            <FlaskConical className="w-4 h-4 text-violet-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">Test Scenarios</h2>
            <p className="text-sm text-slate-500">
              Create and run multi-step API test scenarios
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Scenario List */}
        <ResizablePanel defaultSize={30} minSize={20}>
          <ScenarioList
            projectId={projectId}
            selectedScenario={selectedScenario}
            onSelectScenario={setSelectedScenario}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Scenario Editor / Runner */}
        <ResizablePanel defaultSize={70} minSize={40}>
          {selectedScenario ? (
            mode === 'edit' ? (
              <ScenarioEditor
                scenario={selectedScenario}
                onRunClick={() => setMode('run')}
              />
            ) : (
              <ScenarioRunner
                scenario={selectedScenario}
                onEditClick={() => setMode('edit')}
              />
            )
          ) : (
            <div className="h-full flex items-center justify-center bg-slate-50">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <FlaskConical className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-base font-medium text-slate-900 mb-1">
                  No Scenario Selected
                </h3>
                <p className="text-sm text-slate-500">
                  Select or create a test scenario to get started
                </p>
              </div>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

