import { useState, useEffect } from 'react';
import {
  Play,
  Plus,
  GripVertical,
  Trash2,
  Send,
  GitBranch,
  Repeat,
  Clock,
  Code,
  ChevronDown,
  ChevronUp,
  Settings2,
  Save,
  FileCode,
  Pencil,
  Activity,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useQueryClient } from '@tanstack/react-query';
import { useTestScenario, useTestScenarioSteps } from '@/hooks/useTestScenarios';
import { StepEditor } from './StepEditor';
import { YamlEditor } from './YamlEditor';
import { PerformanceTestPanel } from '@/components/performance';
import { tauriService } from '@/services/tauri';
import { useToast } from '@/hooks/use-toast';
import {
  TestScenario,
  TestScenarioStep,
  TestStepType,
  STEP_TYPE_LABELS,
  DEFAULT_REQUEST_CONFIG,
  DEFAULT_DELAY_CONFIG,
  DEFAULT_SCRIPT_CONFIG,
  DEFAULT_CONDITION_CONFIG,
  DEFAULT_LOOP_CONFIG,
  RequestStepConfig,
} from '@/types/scenario';
import { cn } from '@/lib/utils';

interface Props {
  scenario: TestScenario;
  onRunClick: () => void;
}

const STEP_TYPE_ICONS: Record<TestStepType, React.ReactNode> = {
  request: <Send className="w-4 h-4" />,
  condition: <GitBranch className="w-4 h-4" />,
  loop: <Repeat className="w-4 h-4" />,
  delay: <Clock className="w-4 h-4" />,
  script: <Code className="w-4 h-4" />,
};

const DEFAULT_CONFIGS: Record<TestStepType, any> = {
  request: DEFAULT_REQUEST_CONFIG,
  delay: DEFAULT_DELAY_CONFIG,
  script: DEFAULT_SCRIPT_CONFIG,
  condition: DEFAULT_CONDITION_CONFIG,
  loop: DEFAULT_LOOP_CONFIG,
};

type ViewMode = 'visual' | 'yaml' | 'performance';

export function ScenarioEditor({ scenario, onRunClick }: Props) {
  const [editingStep, setEditingStep] = useState<TestScenarioStep | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [name, setName] = useState(scenario.name);
  const [description, setDescription] = useState(scenario.description || '');
  const [priority, setPriority] = useState<string>(scenario.priority);
  const [viewMode, setViewMode] = useState<ViewMode>('visual');
  const [yamlContent, setYamlContent] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { updateScenario, isUpdating } = useTestScenario(scenario.id);
  const {
    steps,
    isLoading: stepsLoading,
    addStep,
    updateStep,
    deleteStep,
    reorderSteps,
    refetch: refetchSteps,
    isAdding,
  } = useTestScenarioSteps(scenario.id);

  // Load YAML when switching to YAML mode
  const handleSwitchToYaml = async () => {
    setIsExporting(true);
    try {
      const yaml = await tauriService.exportScenarioYaml(scenario.id);
      setYamlContent(yaml);
      setViewMode('yaml');
    } catch (e) {
      toast({
        title: 'Export Error',
        description: e instanceof Error ? e.message : 'Failed to export scenario',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle YAML import (update current scenario)
  const handleYamlImport = async (yamlContent: string) => {
    try {
      // Import as a new scenario, then we can provide option to replace
      await tauriService.importScenarioYaml(scenario.projectId, yamlContent);
      toast({
        title: 'Imported Successfully',
        description: 'Scenario has been imported. Refresh to see changes.',
      });
      refetchSteps();
    } catch (e) {
      toast({
        title: 'Import Error',
        description: e instanceof Error ? e.message : 'Failed to import scenario',
        variant: 'destructive',
      });
    }
  };

  // Handle YAML save (refresh scenario and steps after save)
  const handleYamlSave = async () => {
    try {
      // Invalidate queries to refresh scenario and steps data
      await queryClient.invalidateQueries({ queryKey: ['testScenario', scenario.id] });
      await queryClient.invalidateQueries({ queryKey: ['testScenarios', scenario.projectId] });
      await queryClient.invalidateQueries({ queryKey: ['testScenarioSteps', scenario.id] });
      // Refetch steps to get updated data
      await refetchSteps();
    } catch (e) {
      console.error('Failed to refresh after save:', e);
    }
  };

  useEffect(() => {
    setName(scenario.name);
    setDescription(scenario.description || '');
    setPriority(scenario.priority);
  }, [scenario]);

  // Reload YAML when scenario changes and we're in YAML mode
  useEffect(() => {
    if (viewMode === 'yaml') {
      const loadYaml = async () => {
        setIsExporting(true);
        try {
          const yaml = await tauriService.exportScenarioYaml(scenario.id);
          setYamlContent(yaml);
        } catch (e) {
          toast({
            title: 'Export Error',
            description: e instanceof Error ? e.message : 'Failed to export scenario',
            variant: 'destructive',
          });
          // Reset to empty on error
          setYamlContent('');
        } finally {
          setIsExporting(false);
        }
      };
      loadYaml();
    }
    // Note: We don't reset yamlContent when switching away from YAML mode
    // because handleSwitchToYaml will reload it when switching back
  }, [scenario.id, viewMode, toast]);

  const handleSaveSettings = async () => {
    try {
      await updateScenario({
        id: scenario.id,
        name,
        description: description || undefined,
        priority: priority as 'low' | 'medium' | 'high',
      });
      setShowSettings(false);
    } catch (e) {
      console.error('Failed to update scenario:', e);
    }
  };

  const handleAddStep = async (stepType: TestStepType) => {
    try {
      const step = await addStep({
        scenarioId: scenario.id,
        stepType,
        name: `New ${STEP_TYPE_LABELS[stepType]}`,
        config: DEFAULT_CONFIGS[stepType],
      });
      setEditingStep(step);
    } catch (e) {
      console.error('Failed to add step:', e);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    try {
      await deleteStep(stepId);
      if (editingStep?.id === stepId) {
        setEditingStep(null);
      }
    } catch (e) {
      console.error('Failed to delete step:', e);
    }
  };

  const handleToggleStep = async (step: TestScenarioStep) => {
    try {
      await updateStep({
        id: step.id,
        enabled: !step.enabled,
      });
    } catch (e) {
      console.error('Failed to toggle step:', e);
    }
  };

  const handleMoveStep = async (stepId: string, direction: 'up' | 'down') => {
    const index = steps.findIndex((s) => s.id === stepId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;

    const newStepIds = [...steps.map((s) => s.id)];
    [newStepIds[index], newStepIds[newIndex]] = [newStepIds[newIndex], newStepIds[index]];

    try {
      await reorderSteps(newStepIds);
    } catch (e) {
      console.error('Failed to reorder steps:', e);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-slate-900">{scenario.name}</h3>
            <Badge variant="outline" className="text-xs">
              {steps.length} steps
            </Badge>
            {/* Mode Toggle */}
            <div className="flex items-center rounded-lg border border-slate-200 p-0.5">
              <Button
                variant={viewMode === 'visual' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2"
                onClick={() => setViewMode('visual')}
              >
                <Pencil className="w-3 h-3 mr-1" />
                Visual
              </Button>
              <Button
                variant={viewMode === 'yaml' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2"
                onClick={handleSwitchToYaml}
                disabled={isExporting}
              >
                <FileCode className="w-3 h-3 mr-1" />
                YAML
              </Button>
              <Button
                variant={viewMode === 'performance' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2"
                onClick={() => setViewMode('performance')}
              >
                <Activity className="w-3 h-3 mr-1" />
                Performance
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings2 className="w-4 h-4 mr-1.5" />
              Settings
            </Button>
            <Button size="sm" onClick={onRunClick}>
              <Play className="w-4 h-4 mr-1.5" />
              Run
            </Button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Scenario Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter scenario name"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Priority
                </label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description..."
                rows={2}
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveSettings} disabled={isUpdating}>
                <Save className="w-4 h-4 mr-1.5" />
                Save Settings
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Content Area - Visual, YAML, or Performance Mode */}
      {viewMode === 'yaml' ? (
        <div className="flex-1">
          <YamlEditor
            value={yamlContent}
            onChange={setYamlContent}
            onImport={handleYamlImport}
            onSave={handleYamlSave}
            height="100%"
            showPreview={true}
            showActions={true}
            projectId={scenario.projectId}
            scenarioId={scenario.id}
          />
        </div>
      ) : viewMode === 'performance' ? (
        <div className="flex-1">
          <PerformanceTestPanel scenarioId={scenario.id} />
        </div>
      ) : (
        /* Steps List - Visual Mode */
        <div className="flex-1 flex">
          <div className="flex-1 border-r border-slate-200">
            <ScrollArea className="h-full">
              <div className="p-5 space-y-3">
                {stepsLoading ? (
                  <div className="text-center text-slate-500 py-8">Loading steps...</div>
                ) : steps.length === 0 ? (
                  <Card className="border-dashed">
                    <CardHeader className="text-center">
                      <CardTitle className="text-sm">No Steps Yet</CardTitle>
                      <p className="text-xs text-slate-500">
                        Add your first step to start building the scenario
                      </p>
                    </CardHeader>
                  </Card>
                ) : (
                steps.map((step, index) => (
                  <div
                    key={step.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3.5 rounded-lg border transition-all cursor-pointer mb-3',
                      editingStep?.id === step.id
                        ? 'bg-violet-50 border-violet-200 ring-2 ring-violet-500'
                        : step.enabled
                        ? 'bg-white border-slate-200 hover:bg-slate-50'
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    )}
                    onClick={() => setEditingStep(step)}
                  >
                    <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                    
                    <div className="flex items-center justify-center w-6 h-6 rounded bg-slate-100">
                      <span className="text-xs font-medium text-slate-600">{index + 1}</span>
                    </div>

                    <div
                      className={cn(
                        'flex items-center justify-center w-8 h-8 rounded-lg',
                        step.stepType === 'request' && 'bg-blue-100 text-blue-600',
                        step.stepType === 'condition' && 'bg-amber-100 text-amber-600',
                        step.stepType === 'loop' && 'bg-purple-100 text-purple-600',
                        step.stepType === 'delay' && 'bg-slate-100 text-slate-600',
                        step.stepType === 'script' && 'bg-emerald-100 text-emerald-600'
                      )}
                    >
                      {STEP_TYPE_ICONS[step.stepType]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {step.name}
                        </div>
                        {step.stepType === 'request' && 
                         (step.config as RequestStepConfig)?.withItemsFromCsv && (
                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                            <FileSpreadsheet className="w-3 h-3 mr-1" />
                            CSV
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="text-xs text-slate-500">
                          {STEP_TYPE_LABELS[step.stepType]}
                        </div>
                        {(() => {
                          const csvConfig = step.stepType === 'request' 
                            ? (step.config as RequestStepConfig)?.withItemsFromCsv 
                            : undefined;
                          return csvConfig ? (
                            <div className="text-xs text-slate-400 truncate max-w-[200px]">
                              • {csvConfig.fileName.split('/').pop() || csvConfig.fileName}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 ml-2">
                      {step.stepType === 'request' && !(step.config as RequestStepConfig)?.withItemsFromCsv && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingStep(step);
                                  // Focus will be handled by StepEditor when it opens
                                }}
                              >
                                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Add CSV Data Source</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveStep(step.id, 'up');
                        }}
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveStep(step.id, 'down');
                        }}
                        disabled={index === steps.length - 1}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStep(step);
                        }}
                      >
                        <div
                          className={cn(
                            'w-4 h-4 rounded border-2',
                            step.enabled
                              ? 'bg-violet-500 border-violet-500'
                              : 'border-slate-300'
                          )}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStep(step.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}

              {/* Add Step Button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full mt-4" disabled={isAdding}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add Step
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48">
                  <DropdownMenuItem onClick={() => handleAddStep('request')}>
                    <Send className="w-4 h-4 mr-2 text-blue-600" />
                    HTTP Request
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddStep('delay')}>
                    <Clock className="w-4 h-4 mr-2 text-slate-600" />
                    Delay
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddStep('script')}>
                    <Code className="w-4 h-4 mr-2 text-emerald-600" />
                    Script
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddStep('condition')}>
                    <GitBranch className="w-4 h-4 mr-2 text-amber-600" />
                    Condition
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddStep('loop')}>
                    <Repeat className="w-4 h-4 mr-2 text-purple-600" />
                    Loop
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </ScrollArea>
        </div>

          {/* Step Editor Panel */}
          {editingStep && (
            <div 
              className="w-[500px] h-full bg-slate-50 overflow-hidden flex flex-col"
            >
              <StepEditor
                step={editingStep}
                onClose={() => setEditingStep(null)}
                onSave={async (updates) => {
                  const updatedStep = await updateStep(updates);
                  // Update editingStep with the returned step from server
                  setEditingStep(updatedStep);
                }}
                projectId={scenario.projectId}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

