import { useState } from 'react';
import { Copy, Download, Clock, FileJson, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CodeEditor } from '@/components/shared/CodeEditor';
import { APIResponse } from '@/types/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ResponseViewerProps {
  response: APIResponse;
  onDownload: () => void;
}

export function ResponseViewer({ response, onDownload }: ResponseViewerProps) {
  const [activeTab, setActiveTab] = useState('body');

  const handleCopyResponse = () => {
    const formatted = JSON.stringify(response.data, null, 2);
    navigator.clipboard.writeText(formatted);
    toast({
      title: 'Copied!',
      description: 'Response body copied to clipboard',
    });
  };

  const handleCopyHeaders = () => {
    const formatted = JSON.stringify(response.headers, null, 2);
    navigator.clipboard.writeText(formatted);
    toast({
      title: 'Copied!',
      description: 'Response headers copied to clipboard',
    });
  };

  const responseBodyStr = JSON.stringify(response.data, null, 2);
  const responseSize = new Blob([responseBodyStr]).size;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Response Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Response</h3>
          <TooltipProvider>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleCopyResponse}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy response</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onDownload}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download response</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* Status & Metadata */}
        <div className="flex items-center gap-4 flex-wrap">
          <StatusBadge status={response.status} statusText={response.statusText} />

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            <span className={cn('font-medium', response.duration > 1000 ? 'text-amber-600' : 'text-slate-700')}>
              {response.duration}ms
            </span>
          </div>

          <div className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">{formatSize(responseSize)}</span>
          </div>

          <div className="text-xs text-slate-400">
            {new Date(response.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Response Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-4 py-2 border-b border-slate-200">
          <TabsList className="h-8">
            <TabsTrigger value="body" className="text-xs gap-1.5">
              <FileJson className="w-3.5 h-3.5" />
              Body
            </TabsTrigger>
            <TabsTrigger value="headers" className="text-xs gap-1.5">
              <Settings2 className="w-3.5 h-3.5" />
              Headers
              <span className="ml-1 text-[10px] text-slate-400">
                ({Object.keys(response.headers).length})
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="body" className="flex-1 m-0 p-0 overflow-hidden">
          <div className="h-full p-4">
            <CodeEditor
              value={responseBodyStr}
              language="json"
              height="100%"
              readOnly
              className="h-full"
            />
          </div>
        </TabsContent>

        <TabsContent value="headers" className="flex-1 m-0 p-0 overflow-hidden">
          <div className="h-full">
            <div className="px-4 py-2 border-b border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleCopyHeaders}
              >
                <Copy className="w-3 h-3 mr-1.5" />
                Copy Headers
              </Button>
            </div>
            <div className="p-4 overflow-auto h-[calc(100%-44px)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Header
                    </th>
                    <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(response.headers).map(([key, value]) => (
                    <tr key={key} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4 text-slate-600 font-medium font-mono text-xs">
                        {key}
                      </td>
                      <td className="py-2 text-slate-900 font-mono text-xs break-all">
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

