import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, FileSpreadsheet, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TestScenarioStep,
  UpdateStepRequest,
  RequestStepConfig,
  DelayStepConfig,
  ScriptStepConfig,
  VariableExtractor,
  Assertion,
  ASSERTION_OPERATORS,
  ASSERTION_SOURCES,
  EXTRACTOR_SOURCES,
} from '@/types/scenario';
import { useEndpoints } from '@/hooks/useEndpoints';
import { CsvUploader, CsvConfig } from './CsvUploader';

interface Props {
  step: TestScenarioStep;
  onClose: () => void;
  onSave: (updates: UpdateStepRequest) => Promise<void>;
  projectId?: string;
}

export function StepEditor({ step, onClose, onSave, projectId }: Props) {
  const [name, setName] = useState(step.name);
  const [config, setConfig] = useState<any>(step.config);
  const [isSaving, setIsSaving] = useState(false);
  const [endpointMode, setEndpointMode] = useState<'endpoint' | 'custom'>('endpoint');
  const [csvSectionOpen, setCsvSectionOpen] = useState(false);

  const { endpoints, isLoading: endpointsLoading } = useEndpoints(projectId);

  useEffect(() => {
    setName(step.name);
    setConfig(step.config);
    
    // Determine initial mode based on endpointId
    if (step.stepType === 'request') {
      const requestConfig = step.config as RequestStepConfig;
      if (requestConfig.endpointId) {
        setEndpointMode('endpoint');
      } else {
        setEndpointMode('endpoint');
      }
      // Auto-open CSV section if CSV is already configured
      if (requestConfig.withItemsFromCsv) {
        setCsvSectionOpen(true);
      }
    }
  }, [step]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: UpdateStepRequest = {
        id: step.id,
      };

      // Include name (use current value, trimmed)
      const trimmedName = name?.trim();
      if (trimmedName) {
        updates.name = trimmedName;
      }

      // Include config if it exists
      if (config) {
        updates.config = config;
      }

      await onSave(updates);
    } catch (e) {
      console.error('Failed to save step:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const renderRequestEditor = () => {
    const requestConfig = config as RequestStepConfig;

    const updateConfig = (updates: Partial<RequestStepConfig>) => {
      setConfig({ ...requestConfig, ...updates });
    };

    const handleEndpointSelect = (endpointId: string) => {
      const selectedEndpoint = endpoints.find((ep) => ep.id === endpointId);
      if (selectedEndpoint) {
        const url = `${selectedEndpoint.service}${selectedEndpoint.path}`;
        updateConfig({
          endpointId: selectedEndpoint.id,
          method: selectedEndpoint.method,
          url: url,
        });
        setName(selectedEndpoint.name);
      }
    };

    const handleModeChange = (mode: 'endpoint' | 'custom') => {
      setEndpointMode(mode);
      if (mode === 'custom') {
        // Clear endpointId when switching to custom mode
        updateConfig({ endpointId: undefined });
      }
    };

    const selectedEndpoint = requestConfig.endpointId
      ? endpoints.find((ep) => ep.id === requestConfig.endpointId)
      : null;

    const addExtractor = () => {
      const extractors = requestConfig.extractVariables || [];
      updateConfig({
        extractVariables: [
          ...extractors,
          { name: '', source: 'body', path: '', defaultValue: undefined },
        ],
      });
    };

    const updateExtractor = (index: number, updates: Partial<VariableExtractor>) => {
      const extractors = [...(requestConfig.extractVariables || [])];
      extractors[index] = { ...extractors[index], ...updates };
      updateConfig({ extractVariables: extractors });
    };

    const removeExtractor = (index: number) => {
      const extractors = (requestConfig.extractVariables || []).filter((_, i) => i !== index);
      updateConfig({ extractVariables: extractors });
    };

    const addAssertion = () => {
      const assertions = requestConfig.assertions || [];
      updateConfig({
        assertions: [
          ...assertions,
          { name: '', source: 'status', operator: 'equals', expected: 200 },
        ],
      });
    };

    const updateAssertion = (index: number, updates: Partial<Assertion>) => {
      const assertions = [...(requestConfig.assertions || [])];
      assertions[index] = { ...assertions[index], ...updates };
      updateConfig({ assertions });
    };

    const removeAssertion = (index: number) => {
      const assertions = (requestConfig.assertions || []).filter((_, i) => i !== index);
      updateConfig({ assertions });
    };

    return (
      <div className="space-y-4">
        {/* Endpoint Selection Mode */}
        {projectId && (
          <div>
            <label className="text-xs font-medium text-slate-600 mb-2 block">
              Endpoint Selection
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={endpointMode === 'endpoint' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleModeChange('endpoint')}
                className="flex-1"
              >
                Select from endpoints
              </Button>
              <Button
                type="button"
                variant={endpointMode === 'custom' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleModeChange('custom')}
                className="flex-1"
              >
                Custom URL
              </Button>
            </div>
          </div>
        )}

        {/* Endpoint Selector */}
        {projectId && endpointMode === 'endpoint' && (
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Select Endpoint
            </label>
            {endpointsLoading ? (
              <p className="text-xs text-slate-400 py-2">Loading endpoints...</p>
            ) : endpoints.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No endpoints available</p>
            ) : (
              <Select
                value={requestConfig.endpointId || ''}
                onValueChange={handleEndpointSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an endpoint" />
                </SelectTrigger>
                <SelectContent>
                  {endpoints.map((endpoint) => (
                    <SelectItem key={endpoint.id} value={endpoint.id}>
                      {endpoint.method} {endpoint.path}
                      {endpoint.name && ` - ${endpoint.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* URL & Method */}
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">URL</label>
          <div className="flex gap-2">
            <Select
              value={requestConfig.method || 'GET'}
              onValueChange={(v) => updateConfig({ method: v })}
              disabled={endpointMode === 'endpoint' && !!selectedEndpoint}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={requestConfig.url || ''}
              onChange={(e) => updateConfig({ url: e.target.value })}
              placeholder="https://api.example.com/endpoint"
              className="flex-1"
              disabled={endpointMode === 'endpoint' && !!selectedEndpoint}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {endpointMode === 'endpoint' && selectedEndpoint
              ? 'URL is automatically filled from selected endpoint'
              : "Use {'{{variableName}}'} to inject variables"}
          </p>
        </div>

        {/* Headers */}
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Headers (JSON)</label>
          <Textarea
            value={JSON.stringify(requestConfig.headers || {}, null, 2)}
            onChange={(e) => {
              try {
                updateConfig({ headers: JSON.parse(e.target.value) });
              } catch {}
            }}
            placeholder='{"Authorization": "Bearer {{token}}"}'
            rows={3}
            className="font-mono text-xs"
          />
        </div>

        <Separator />

        {/* CSV Data Source - Moved up */}
        <Collapsible open={csvSectionOpen} onOpenChange={setCsvSectionOpen}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between w-full p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <label className="text-xs font-medium text-slate-600 cursor-pointer">
                  CSV Data Source
                </label>
                {requestConfig.withItemsFromCsv && (
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                    Enabled
                  </Badge>
                )}
              </div>
              {csvSectionOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="space-y-3">
              {requestConfig.withItemsFromCsv ? (
                <>
                  <CsvUploader
                    currentConfig={requestConfig.withItemsFromCsv}
                    onCsvSelected={(csvConfig: CsvConfig) => {
                      updateConfig({
                        withItemsFromCsv: csvConfig,
                      });
                    }}
                  />
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-medium text-blue-900 mb-1">How to use CSV variables:</p>
                    <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                      <li>Use <code className="px-1 py-0.5 bg-blue-100 rounded">{'{{ item.columnName }}'}</code> in URL, headers, or body</li>
                      <li>Use <code className="px-1 py-0.5 bg-blue-100 rounded">{'{{ index }}'}</code> for row index (0, 1, 2...)</li>
                      <li>Step will run once for each CSV row</li>
                    </ul>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => updateConfig({ withItemsFromCsv: undefined })}
                  >
                    Remove CSV Data Source
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="text-center py-4 border border-dashed border-slate-300 rounded-lg">
                    <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-600 mb-3">
                      Use CSV data to run this request multiple times with different data
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        updateConfig({
                          withItemsFromCsv: {
                            fileName: '',
                            quoteChar: '"',
                            delimiter: ',',
                          },
                        });
                        setCsvSectionOpen(true);
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add CSV Data Source
                    </Button>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-xs font-medium text-slate-700 mb-1">Example CSV format:</p>
                    <pre className="text-xs text-slate-600 font-mono bg-white p-2 rounded border border-slate-200 overflow-x-auto">
{`email,name,password
user1@test.com,User 1,pass123
user2@test.com,User 2,pass456`}
                    </pre>
                    <p className="text-xs text-slate-500 mt-2">
                      Then use <code className="px-1 py-0.5 bg-slate-200 rounded">{'{{ item.email }}'}</code> in your request body
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Body */}
        {requestConfig.method !== 'GET' && (
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Body (JSON)</label>
            <Textarea
              value={JSON.stringify(requestConfig.body || requestConfig.params || {}, null, 2)}
              onChange={(e) => {
                try {
                  updateConfig({ body: JSON.parse(e.target.value) });
                } catch {}
              }}
              placeholder='{"key": "value"}'
              rows={4}
              className="font-mono text-xs"
            />
          </div>
        )}

        <Separator />

        {/* Variable Extractors */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-slate-600">Extract Variables</label>
            <Button variant="ghost" size="sm" onClick={addExtractor}>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {(requestConfig.extractVariables || []).map((extractor, index) => (
              <div key={index} className="flex gap-2 items-start p-2 bg-slate-50 rounded-lg">
                <Input
                  value={extractor.name}
                  onChange={(e) => updateExtractor(index, { name: e.target.value })}
                  placeholder="Variable name"
                  className="flex-1"
                />
                <Select
                  value={extractor.source}
                  onValueChange={(v) => updateExtractor(index, { source: v as any })}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXTRACTOR_SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={extractor.path}
                  onChange={(e) => updateExtractor(index, { path: e.target.value })}
                  placeholder="data.token"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-red-500"
                  onClick={() => removeExtractor(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {(requestConfig.extractVariables || []).length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">
                No extractors defined
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Assertions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-slate-600">Assertions</label>
            <Button variant="ghost" size="sm" onClick={addAssertion}>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {(requestConfig.assertions || []).map((assertion, index) => (
              <div key={index} className="p-2 bg-slate-50 rounded-lg space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={assertion.name}
                    onChange={(e) => updateAssertion(index, { name: e.target.value })}
                    placeholder="Assertion name"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-red-500"
                    onClick={() => removeAssertion(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={assertion.source}
                    onValueChange={(v) => updateAssertion(index, { source: v as any })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSERTION_SOURCES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(assertion.source === 'body' || assertion.source === 'header') && (
                    <Input
                      value={assertion.path || ''}
                      onChange={(e) => updateAssertion(index, { path: e.target.value })}
                      placeholder="JSON path"
                      className="flex-1"
                    />
                  )}
                  <Select
                    value={assertion.operator}
                    onValueChange={(v) => updateAssertion(index, { operator: v as any })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSERTION_OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={
                      typeof assertion.expected === 'string'
                        ? assertion.expected
                        : JSON.stringify(assertion.expected)
                    }
                    onChange={(e) => {
                      let value: any = e.target.value;
                      // Try to parse as number
                      if (!isNaN(Number(value))) {
                        value = Number(value);
                      }
                      updateAssertion(index, { expected: value });
                    }}
                    placeholder="Expected value"
                    className="flex-1"
                  />
                </div>
              </div>
            ))}
            {(requestConfig.assertions || []).length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">No assertions defined</p>
            )}
          </div>
        </div>

      </div>
    );
  };

  const renderDelayEditor = () => {
    const delayConfig = config as DelayStepConfig;

    return (
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">
          Delay Duration (milliseconds)
        </label>
        <Input
          type="number"
          value={delayConfig.durationMs || 1000}
          onChange={(e) => setConfig({ durationMs: parseInt(e.target.value) || 1000 })}
          min={0}
        />
        <p className="text-[10px] text-slate-400 mt-1">
          {((delayConfig.durationMs || 1000) / 1000).toFixed(1)} seconds
        </p>
      </div>
    );
  };

  const renderScriptEditor = () => {
    const scriptConfig = config as ScriptStepConfig;

    return (
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">JavaScript Code</label>
        <Textarea
          value={scriptConfig.code || ''}
          onChange={(e) => setConfig({ code: e.target.value })}
          placeholder="// Write your JavaScript code here"
          rows={10}
          className="font-mono text-xs"
        />
        <p className="text-[10px] text-slate-400 mt-1">
          Note: Script execution is limited in current version
        </p>
      </div>
    );
  };

  const renderConditionEditor = () => {
    return (
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            Condition Expression
          </label>
          <Input
            value={config.condition || ''}
            onChange={(e) => setConfig({ ...config, condition: e.target.value })}
            placeholder="{{status}} === 200"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            JavaScript expression using variables
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Condition branching will be available in a future update.
        </p>
      </div>
    );
  };

  const renderLoopEditor = () => {
    return (
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Loop Type</label>
          <Select
            value={config.loopType || 'for'}
            onValueChange={(v) => setConfig({ ...config, loopType: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="for">For Loop</SelectItem>
              <SelectItem value="foreach">For Each</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {config.loopType === 'for' && (
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Iteration Count
            </label>
            <Input
              type="number"
              value={config.count || 1}
              onChange={(e) => setConfig({ ...config, count: parseInt(e.target.value) || 1 })}
              min={1}
            />
          </div>
        )}
        <p className="text-xs text-slate-500">
          Loop functionality will be available in a future update.
        </p>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
        <h4 className="font-medium text-slate-900">Edit Step</h4>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Step Name */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Step Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter step name"
            />
          </div>

          <Separator />

          {/* Step-specific config */}
          {step.stepType === 'request' && renderRequestEditor()}
          {step.stepType === 'delay' && renderDelayEditor()}
          {step.stepType === 'script' && renderScriptEditor()}
          {step.stepType === 'condition' && renderConditionEditor()}
          {step.stepType === 'loop' && renderLoopEditor()}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-200 bg-white">
        <Button className="w-full" onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-1.5" />
          {isSaving ? 'Saving...' : 'Save Step'}
        </Button>
      </div>
    </div>
  );
}

