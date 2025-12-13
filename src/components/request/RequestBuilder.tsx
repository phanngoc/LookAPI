import { useCallback } from 'react';
import { RotateCcw, FileJson, Code2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { UrlBar } from './UrlBar';
import { CodeEditor } from '@/components/shared/CodeEditor';
import { ResponseViewer } from '@/components/response/ResponseViewer';
import { ResponseSchemaViewer } from './ResponseSchemaViewer';
import { RequestTab } from '@/types/requestTab';
import { tauriService } from '@/services/tauri';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import { toast } from '@/hooks/use-toast';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

interface RequestBuilderProps {
  tab: RequestTab;
  onUpdate: (tabId: string, updates: Partial<RequestTab>) => void;
}

export function RequestBuilder({ tab, onUpdate }: RequestBuilderProps) {
  const { resolveVariables, activeEnvironment } = useEnvironment();

  const updateTab = useCallback(
    (updates: Partial<RequestTab>) => {
      onUpdate(tab.id, updates);
    },
    [tab.id, onUpdate]
  );

  const handleReset = () => {
    if (!tab.endpoint) return;
    
    const params = tab.endpoint.parameters.reduce((acc, param) => {
      acc[param.name] = param.defaultValue ?? param.example ?? '';
      return acc;
    }, {} as Record<string, unknown>);

    updateTab({
      bodyJson: JSON.stringify(params, null, 2),
      error: null,
    });
  };

  const handleExecute = async () => {
    updateTab({ isExecuting: true, error: null });

    try {
      // Parse body
      let parameters = {};
      if (tab.bodyJson.trim()) {
        try {
          parameters = JSON.parse(tab.bodyJson);
        } catch {
          updateTab({
            error: 'Invalid JSON in request body',
            isExecuting: false,
          });
          return;
        }
      }

      // Parse headers
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        headers = JSON.parse(tab.headersJson);
      } catch {
        // Use default headers
      }

      // Resolve environment variables in URL
      const resolvedUrl = resolveVariables(tab.url);

      const request = {
        endpoint: resolvedUrl,
        method: tab.method,
        parameters,
        headers,
      };

      const result = await tauriService.executeHttpRequest(request);

      // Generate curl command
      const curl = await tauriService.generateCurlCommand(resolvedUrl, tab.method, parameters);

      updateTab({
        response: result,
        curlCommand: curl,
        isExecuting: false,
        error: null,
      });

      toast({
        title: 'Request completed',
        description: `${result.status} ${result.statusText} in ${result.duration}ms`,
        variant: result.status >= 200 && result.status < 300 ? 'success' : 'destructive',
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      updateTab({
        error: errorMessage || 'Request failed',
        isExecuting: false,
      });
      toast({
        title: 'Request failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleCopyCurl = () => {
    if (tab.curlCommand) {
      navigator.clipboard.writeText(tab.curlCommand);
      toast({
        title: 'Copied!',
        description: 'cURL command copied to clipboard',
      });
    }
  };

  const handleDownloadResponse = async () => {
    if (tab.response) {
      const endpointName = tab.endpoint?.name || 'response';
      const filename = `response_${endpointName}_${Date.now()}.json`;
      const content = JSON.stringify(tab.response.data, null, 2);

      try {
        await tauriService.exportResponse(filename, content);
        toast({
          title: 'Exported!',
          description: `Response saved to ${filename}`,
          variant: 'success',
        });
      } catch {
        toast({
          title: 'Export failed',
          description: 'Failed to export response',
          variant: 'destructive',
        });
      }
    }
  };

  const endpoint = tab.endpoint;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Endpoint Info */}
      {endpoint && (
        <div className="px-4 pt-4 pb-2 bg-white border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{endpoint.name}</h2>
              {endpoint.description && (
                <p className="text-sm text-slate-500 mt-0.5">{endpoint.description}</p>
              )}
            </div>
            {activeEnvironment && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: activeEnvironment.color }}
                />
                <span>{activeEnvironment.name}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* URL Bar */}
      <UrlBar
        method={tab.method}
        url={tab.url}
        onMethodChange={(method) => updateTab({ method })}
        onUrlChange={(url) => updateTab({ url })}
        onExecute={handleExecute}
        isExecuting={tab.isExecuting}
        disabled={!!tab.error}
      />

      {/* Request/Response Split */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Request Panel */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col bg-white border-r border-slate-200">
            {/* Request Tabs */}
            <Tabs
              value={tab.activeTab}
              onValueChange={(value) => updateTab({ activeTab: value as 'body' | 'headers' | 'response-schema' })}
              className="flex-1 flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
                <TabsList className="h-8">
                  <TabsTrigger value="body" className="text-xs gap-1.5">
                    <FileJson className="w-3.5 h-3.5" />
                    Body
                  </TabsTrigger>
                  <TabsTrigger value="headers" className="text-xs gap-1.5">
                    <Settings2 className="w-3.5 h-3.5" />
                    Headers
                  </TabsTrigger>
                  {endpoint && (
                    <TabsTrigger value="response-schema" className="text-xs gap-1.5">
                      <FileJson className="w-3.5 h-3.5" />
                      Response Schema
                      {endpoint.responses && endpoint.responses.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">
                          {endpoint.responses.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  )}
                </TabsList>

                <TooltipProvider>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleReset}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Reset to defaults</TooltipContent>
                    </Tooltip>

                    {tab.curlCommand && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleCopyCurl}
                          >
                            <Code2 className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy as cURL</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TooltipProvider>
              </div>

              <TabsContent value="body" className="flex-1 m-0 p-0">
                <div className="h-full p-4">
                  <CodeEditor
                    value={tab.bodyJson}
                    onChange={(value) => updateTab({ bodyJson: value })}
                    language="json"
                    height="100%"
                    className="h-full"
                  />
                </div>
                {tab.error && (
                  <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{tab.error}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="headers" className="flex-1 m-0 p-0">
                <div className="h-full p-4">
                  <CodeEditor
                    value={tab.headersJson}
                    onChange={(value) => updateTab({ headersJson: value })}
                    language="json"
                    height="100%"
                    className="h-full"
                  />
                </div>
              </TabsContent>

              {endpoint && (
                <TabsContent value="response-schema" className="flex-1 m-0 p-0 overflow-auto">
                  <ResponseSchemaViewer responses={endpoint.responses} />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Response Panel */}
        <ResizablePanel defaultSize={50} minSize={30}>
          {tab.response ? (
            <ResponseViewer response={tab.response} onDownload={handleDownloadResponse} />
          ) : (
            <div className="h-full flex items-center justify-center bg-slate-50">
              <Card className="w-80 text-center border-dashed">
                <CardHeader>
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                    <Code2 className="w-6 h-6 text-slate-400" />
                  </div>
                  <CardTitle className="text-base">No Response Yet</CardTitle>
                  <CardDescription>
                    Send a request to see the response here
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-400">
                    Press{' '}
                    <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">
                      ⌘ Enter
                    </kbd>{' '}
                    to send
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

