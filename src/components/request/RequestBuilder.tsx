import { useState, useEffect } from 'react';
import { RotateCcw, FileJson, Code2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { APIEndpoint, APIResponse } from '@/types/api';
import { tauriService } from '@/services/tauri';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import { useProject } from '@/contexts/ProjectContext';
import { toast } from '@/hooks/use-toast';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { getBaseUrlForProject, buildFullUrl } from '@/utils/url';

interface RequestBuilderProps {
  endpoint: APIEndpoint;
}

export function RequestBuilder({ endpoint }: RequestBuilderProps) {
  const { resolveVariables, activeEnvironment, getVariable } = useEnvironment();
  const { currentProject } = useProject();
  const [method, setMethod] = useState<string>(endpoint.method);
  const [url, setUrl] = useState('');
  const [bodyJson, setBodyJson] = useState('');
  const [headersJson, setHeadersJson] = useState('{\n  "Content-Type": "application/json"\n}');
  const [isExecuting, setIsExecuting] = useState(false);
  const [response, setResponse] = useState<APIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [curlCommand, setCurlCommand] = useState('');
  const [activeTab, setActiveTab] = useState('body');

  // Initialize from endpoint
  useEffect(() => {
    if (endpoint) {
      setMethod(endpoint.method);
      
      // Build URL from project settings or environment
      const envBaseUrl = getVariable('BASE_URL');
      const baseUrl = getBaseUrlForProject(currentProject, envBaseUrl, endpoint.service);
      setUrl(buildFullUrl(baseUrl, endpoint.path));

      // Build body from parameters
      const params = endpoint.parameters.reduce((acc, param) => {
        acc[param.name] = param.defaultValue ?? param.example ?? '';
        return acc;
      }, {} as Record<string, unknown>);

      setBodyJson(JSON.stringify(params, null, 2));
      setResponse(null);
      setError(null);
      setCurlCommand('');
    }
  }, [endpoint, currentProject, getVariable]);

  const handleReset = () => {
    const params = endpoint.parameters.reduce((acc, param) => {
      acc[param.name] = param.defaultValue ?? param.example ?? '';
      return acc;
    }, {} as Record<string, unknown>);

    setBodyJson(JSON.stringify(params, null, 2));
    setError(null);
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    setError(null);

    try {
      // Parse body
      let parameters = {};
      if (bodyJson.trim()) {
        try {
          parameters = JSON.parse(bodyJson);
        } catch {
          setError('Invalid JSON in request body');
          setIsExecuting(false);
          return;
        }
      }

      // Parse headers
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        headers = JSON.parse(headersJson);
      } catch {
        // Use default headers
      }

      // Resolve environment variables in URL
      const resolvedUrl = resolveVariables(url);

      const request = {
        endpoint: resolvedUrl,
        method,
        parameters,
        headers,
      };

      const result = await tauriService.executeHttpRequest(request);
      setResponse(result);

      // Generate curl command
      const curl = await tauriService.generateCurlCommand(resolvedUrl, method, parameters);
      setCurlCommand(curl);

      toast({
        title: 'Request completed',
        description: `${result.status} ${result.statusText} in ${result.duration}ms`,
        variant: result.status >= 200 && result.status < 300 ? 'success' : 'destructive',
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'Request failed');
      toast({
        title: 'Request failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyCurl = () => {
    if (curlCommand) {
      navigator.clipboard.writeText(curlCommand);
      toast({
        title: 'Copied!',
        description: 'cURL command copied to clipboard',
      });
    }
  };

  const handleDownloadResponse = async () => {
    if (response) {
      const filename = `response_${endpoint.name}_${Date.now()}.json`;
      const content = JSON.stringify(response.data, null, 2);

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

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Endpoint Info */}
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

      {/* URL Bar */}
      <UrlBar
        method={method}
        url={url}
        onMethodChange={setMethod}
        onUrlChange={setUrl}
        onExecute={handleExecute}
        isExecuting={isExecuting}
        disabled={!!error}
      />

      {/* Request/Response Split */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Request Panel */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col bg-white border-r border-slate-200">
            {/* Request Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
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

                    {curlCommand && (
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
                    value={bodyJson}
                    onChange={setBodyJson}
                    language="json"
                    height="100%"
                    className="h-full"
                  />
                </div>
                {error && (
                  <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="headers" className="flex-1 m-0 p-0">
                <div className="h-full p-4">
                  <CodeEditor
                    value={headersJson}
                    onChange={setHeadersJson}
                    language="json"
                    height="100%"
                    className="h-full"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Response Panel */}
        <ResizablePanel defaultSize={50} minSize={30}>
          {response ? (
            <ResponseViewer response={response} onDownload={handleDownloadResponse} />
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

