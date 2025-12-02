import React, { useState } from 'react';
import { Play, Database, Loader2, Download, Copy, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CodeEditor } from '@/components/shared/CodeEditor';
import { ScrollArea } from '@/components/ui/scroll-area';
import { QueryResult } from '@/types/api';
import { tauriService } from '@/services/tauri';
import { toast } from '@/hooks/use-toast';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';

const defaultQuery = `-- Enter your SQL query here
SELECT * FROM table_name LIMIT 10;`;

export function DatabaseQueryPanel() {
  const [dbPath, setDbPath] = useState('');
  const [query, setQuery] = useState(defaultQuery);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    if (!dbPath.trim()) {
      toast({
        title: 'Missing database path',
        description: 'Please provide the path to your SQLite database',
        variant: 'destructive',
      });
      return;
    }

    if (!query.trim()) {
      toast({
        title: 'Missing query',
        description: 'Please enter a SQL query to execute',
        variant: 'destructive',
      });
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const queryResult = await tauriService.executeSqlQuery(dbPath, query);
      setResult(queryResult);
      toast({
        title: 'Query executed',
        description: `Returned ${queryResult.row_count} rows`,
        variant: 'success',
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'Query execution failed');
      setResult(null);
      toast({
        title: 'Query failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleExecute();
    }
  };

  const handleCopyResults = () => {
    if (result) {
      const csv = [
        result.columns.join(','),
        ...result.rows.map((row) => row.map((cell) => JSON.stringify(cell)).join(',')),
      ].join('\n');
      navigator.clipboard.writeText(csv);
      toast({
        title: 'Copied!',
        description: 'Results copied as CSV',
      });
    }
  };

  const handleExportResults = () => {
    if (result) {
      const csv = [
        result.columns.join(','),
        ...result.rows.map((row) => row.map((cell) => JSON.stringify(cell)).join(',')),
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `query_results_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Exported!',
        description: 'Results exported as CSV',
        variant: 'success',
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="px-4 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100">
            <Database className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Database Query</h2>
            <p className="text-sm text-slate-500">Execute SQL queries against SQLite databases</p>
          </div>
        </div>

        {/* Database Path */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={dbPath}
              onChange={(e) => setDbPath(e.target.value)}
              placeholder="/path/to/database.db"
              className="pl-9 font-mono text-sm bg-slate-50"
            />
          </div>
          <Button
            onClick={handleExecute}
            disabled={isExecuting || !dbPath.trim() || !query.trim()}
            className="gap-2"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Run Query</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Query & Results */}
      <ResizablePanelGroup direction="vertical" className="flex-1">
        {/* Query Editor */}
        <ResizablePanel defaultSize={40} minSize={20}>
          <div className="h-full flex flex-col bg-white border-b border-slate-200">
            <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                SQL Query
              </span>
              <span className="text-xs text-slate-400">
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">⌘ Enter</kbd> to run
              </span>
            </div>
            <div className="flex-1 p-4" onKeyDown={handleKeyDown}>
              <CodeEditor
                value={query}
                onChange={setQuery}
                language="sql"
                height="100%"
                className="h-full"
              />
            </div>
            {error && (
              <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 font-mono">{error}</p>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Results */}
        <ResizablePanel defaultSize={60} minSize={30}>
          {result ? (
            <div className="h-full flex flex-col bg-white">
              {/* Results Header */}
              <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Results
                  </span>
                  <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {result.row_count} rows
                  </span>
                </div>
                <TooltipProvider>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleCopyResults}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy as CSV</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleExportResults}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Export as CSV</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </div>

              {/* Results Table */}
              {result.row_count > 0 ? (
                <ScrollArea className="flex-1" orientation="both">
                  <div className="min-w-max">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-slate-50 w-12">
                            #
                          </th>
                          {result.columns.map((column, index) => (
                            <th
                              key={index}
                              className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-slate-50"
                            >
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className={cn(
                              'hover:bg-slate-50 transition-colors',
                              rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-25'
                            )}
                          >
                            <td className="px-4 py-2 text-xs text-slate-400 border-b border-slate-100 font-mono">
                              {rowIndex + 1}
                            </td>
                            {row.map((cell, cellIndex) => (
                              <td
                                key={cellIndex}
                                className="px-4 py-2 text-sm text-slate-900 border-b border-slate-100 max-w-xs"
                                title={String(cell)}
                              >
                                {cell === null ? (
                                  <span className="text-slate-400 italic text-xs">NULL</span>
                                ) : typeof cell === 'object' ? (
                                  <code className="text-xs bg-slate-100 px-1 py-0.5 rounded font-mono">
                                    {JSON.stringify(cell)}
                                  </code>
                                ) : (
                                  <span className="font-mono text-xs">{String(cell)}</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <Database className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">Query executed successfully</p>
                    <p className="text-xs text-slate-400">No rows returned</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-slate-50">
              <Card className="w-80 text-center border-dashed">
                <CardHeader>
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                    <Database className="w-6 h-6 text-slate-400" />
                  </div>
                  <CardTitle className="text-base">No Results Yet</CardTitle>
                  <CardDescription>
                    Run a query to see results here
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-400">
                    Press{' '}
                    <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">
                      ⌘ Enter
                    </kbd>{' '}
                    to execute
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

