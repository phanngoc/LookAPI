import { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
  AlertCircle,
  CheckCircle,
  Copy,
  Download,
  Upload,
  FileCode,
  RefreshCw,
  FileText,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { tauriService } from '@/services/tauri';
import { ScenarioImportPreview, ProjectImportPreview } from '@/types/yaml';
import { useProject } from '@/contexts/ProjectContext';

interface YamlEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onImport?: (yamlContent: string) => void;
  readOnly?: boolean;
  height?: string | number;
  showPreview?: boolean;
  showActions?: boolean;
  mode?: 'single' | 'project';
  className?: string;
}

export function YamlEditor({
  value,
  onChange,
  onImport,
  readOnly = false,
  height = '400px',
  showPreview = true,
  showActions = true,
  mode = 'single',
  className,
}: YamlEditorProps) {
  const { currentProject } = useProject();
  const [content, setContent] = useState(value);
  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ScenarioImportPreview | ProjectImportPreview | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // AI Generation states
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAIError] = useState<string | null>(null);

  // Validate YAML content
  const validateYaml = useCallback(async (yamlContent: string) => {
    if (!yamlContent.trim()) {
      setIsValid(true);
      setError(null);
      setPreview(null);
      return;
    }

    setIsValidating(true);
    try {
      let result;
      if (mode === 'project') {
        result = await tauriService.previewProjectScenariosYamlImport(yamlContent);
      } else {
        result = await tauriService.previewScenarioYamlImport(yamlContent);
      }
      setIsValid(true);
      setError(null);
      setPreview(result);
    } catch (e) {
      setIsValid(false);
      setError(e instanceof Error ? e.message : String(e));
      setPreview(null);
    } finally {
      setIsValidating(false);
    }
  }, [mode]);

  // Debounced validation
  useEffect(() => {
    const timer = setTimeout(() => {
      validateYaml(content);
    }, 500);
    return () => clearTimeout(timer);
  }, [content, validateYaml]);

  // Sync with external value
  useEffect(() => {
    if (value !== content) {
      setContent(value);
    }
  }, [value]);

  const handleChange = (newValue: string | undefined) => {
    const val = newValue || '';
    setContent(val);
    onChange?.(val);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mode === 'project' ? 'project-scenarios.yaml' : 'scenario.yaml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        setContent(text);
        onChange?.(text);
      }
    };
    input.click();
  };

  const handleLoadTemplate = async () => {
    try {
      const template = await tauriService.getYamlTemplate();
      setContent(template);
      onChange?.(template);
    } catch (e) {
      console.error('Failed to load template:', e);
    }
  };

  const handleOpenAIDialog = () => {
    if (!currentProject) {
      setAIError('Please select a project first to use AI generation');
      return;
    }
    setAIError(null);
    setAIPrompt('');
    setShowAIDialog(true);
  };

  const handleGenerateWithAI = async () => {
    if (!currentProject || !aiPrompt.trim()) return;
    
    setIsGenerating(true);
    setAIError(null);
    
    try {
      const generatedYaml = await tauriService.generateYamlWithAI(
        currentProject.path,
        aiPrompt,
        currentProject.id,
        currentProject.baseUrl || undefined
      );
      
      setContent(generatedYaml);
      onChange?.(generatedYaml);
      setShowAIDialog(false);
      setAIPrompt('');
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setAIError(errorMessage);
      console.error('Failed to generate with AI:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImport = () => {
    if (isValid && onImport) {
      onImport(content);
    }
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      {showActions && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">YAML Editor</span>
            {isValidating && (
              <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />
            )}
            {!isValidating && isValid && content.trim() && (
              <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                <CheckCircle className="w-3 h-3 mr-1" />
                Valid
              </Badge>
            )}
            {!isValidating && !isValid && (
              <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                <AlertCircle className="w-3 h-3 mr-1" />
                Invalid
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenAIDialog}
              title="Generate with AI (Copilot CLI)"
              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            >
              <Sparkles className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadTemplate}
              title="Load template"
            >
              <FileText className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUpload}
              title="Upload YAML file"
            >
              <Upload className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              disabled={!content.trim()}
              title="Download YAML file"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={!content.trim()}
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 flex">
        <div className={cn('flex-1', showPreview ? 'border-r border-slate-200' : '')}>
          <Editor
            height={height}
            language="yaml"
            value={content}
            onChange={handleChange}
            theme="vs"
            options={{
              readOnly,
              minimap: { enabled: false },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              tabSize: 2,
              automaticLayout: true,
              wordWrap: 'on',
              folding: true,
              renderLineHighlight: 'line',
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="w-64 bg-slate-50">
            <ScrollArea className="h-full">
              <div className="p-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">
                  Preview
                </h4>
                
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-red-700">{error}</p>
                    </div>
                  </div>
                )}

                {preview && mode === 'single' && (
                  <SingleScenarioPreview preview={preview as ScenarioImportPreview} />
                )}

                {preview && mode === 'project' && (
                  <ProjectPreview preview={preview as ProjectImportPreview} />
                )}

                {!preview && !error && content.trim() && (
                  <p className="text-xs text-slate-400 text-center py-4">
                    Validating...
                  </p>
                )}

                {!preview && !error && !content.trim() && (
                  <p className="text-xs text-slate-400 text-center py-4">
                    Enter YAML content or upload a file
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Import Button */}
      {onImport && (
        <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex justify-end">
          <Button
            size="sm"
            onClick={handleImport}
            disabled={!isValid || !content.trim() || isValidating}
          >
            Import Scenario{mode === 'project' ? 's' : ''}
          </Button>
        </div>
      )}

      {/* AI Generation Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Generate Test Scenario with AI
            </DialogTitle>
            <DialogDescription>
              Describe what kind of test scenario you want to generate. The AI will use your project's API endpoints as context.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {currentProject && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Project</p>
                <p className="text-sm font-medium text-slate-900">{currentProject.name}</p>
                <p className="text-xs text-slate-500 truncate">{currentProject.path}</p>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Describe your test scenario
              </label>
              <Textarea
                placeholder="E.g., Create a test scenario for user authentication flow including login, get profile, and logout..."
                value={aiPrompt}
                onChange={(e) => setAIPrompt(e.target.value)}
                className="min-h-[120px] resize-none"
                disabled={isGenerating}
              />
            </div>
            
            {aiError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{aiError}</p>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAIDialog(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateWithAI}
              disabled={!aiPrompt.trim() || isGenerating}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Single scenario preview component
function SingleScenarioPreview({ preview }: { preview: ScenarioImportPreview }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-900">{preview.name}</p>
        {preview.description && (
          <p className="text-xs text-slate-500 mt-1">{preview.description}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white p-2 rounded border border-slate-200">
          <p className="text-lg font-semibold text-slate-900">{preview.stepsCount}</p>
          <p className="text-xs text-slate-500">Steps</p>
        </div>
        <div className="bg-white p-2 rounded border border-slate-200">
          <p className="text-lg font-semibold text-slate-900">{preview.variablesCount}</p>
          <p className="text-xs text-slate-500">Variables</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-600 mb-2">Steps:</p>
        <div className="space-y-1">
          {preview.steps.map((step, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-2 p-2 rounded text-xs',
                step.enabled ? 'bg-white border border-slate-200' : 'bg-slate-100 opacity-60'
              )}
            >
              <Badge variant="outline" className="text-[10px]">
                {step.stepType}
              </Badge>
              <span className="truncate">{step.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Project preview component
function ProjectPreview({ preview }: { preview: ProjectImportPreview }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-900">{preview.projectName}</p>
        <p className="text-xs text-slate-500">Project Export</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white p-2 rounded border border-slate-200">
          <p className="text-lg font-semibold text-slate-900">{preview.scenariosCount}</p>
          <p className="text-xs text-slate-500">Scenarios</p>
        </div>
        <div className="bg-white p-2 rounded border border-slate-200">
          <p className="text-lg font-semibold text-slate-900">{preview.totalSteps}</p>
          <p className="text-xs text-slate-500">Total Steps</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-600 mb-2">Scenarios:</p>
        <div className="space-y-1">
          {preview.scenarios.map((scenario, i) => (
            <div
              key={i}
              className="p-2 bg-white rounded border border-slate-200"
            >
              <p className="text-xs font-medium text-slate-900 truncate">
                {scenario.name}
              </p>
              <p className="text-[10px] text-slate-500">
                {scenario.stepsCount} steps, {scenario.variablesCount} vars
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
