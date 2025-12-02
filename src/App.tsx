import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { RequestBuilder } from '@/components/request/RequestBuilder';
import { TestSuiteRunner } from '@/components/test-suite/TestSuiteRunner';
import { DatabaseQueryPanel } from '@/components/database/DatabaseQueryPanel';
import { EnvironmentProvider } from '@/contexts/EnvironmentContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { APIEndpoint, TestSuite } from '@/types/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Database, Layers, ArrowRight, Code2, FolderCode } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

type ViewMode = 'request' | 'test-suite' | 'database' | 'welcome';

function WelcomeScreen({ onSelectDatabase }: { onSelectDatabase: () => void }) {
  return (
    <div className="h-full flex items-center justify-center bg-gradient-subtle p-8">
      <div className="max-w-4xl w-full">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25 mb-6">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">
            Welcome to API Tester
          </h1>
          <p className="text-lg text-slate-500 max-w-md mx-auto">
            A powerful tool for testing APIs, running test suites, and querying databases.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="group hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-default">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 mb-3 group-hover:scale-110 transition-transform">
                <FolderCode className="w-5 h-5 text-blue-600" />
              </div>
              <CardTitle className="text-base">Open Project</CardTitle>
              <CardDescription className="text-sm">
                Select a project folder and scan for API endpoints automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center text-xs text-blue-600 font-medium group-hover:gap-2 transition-all">
                <span>Use header menu</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-default">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 mb-3 group-hover:scale-110 transition-transform">
                <Code2 className="w-5 h-5 text-emerald-600" />
              </div>
              <CardTitle className="text-base">API Testing</CardTitle>
              <CardDescription className="text-sm">
                Test individual API endpoints with custom parameters and headers
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center text-xs text-blue-600 font-medium group-hover:gap-2 transition-all">
                <span>Select an endpoint</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-default">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 mb-3 group-hover:scale-110 transition-transform">
                <Layers className="w-5 h-5 text-amber-600" />
              </div>
              <CardTitle className="text-base">Test Suites</CardTitle>
              <CardDescription className="text-sm">
                Run multiple endpoints sequentially with automated testing
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center text-xs text-blue-600 font-medium group-hover:gap-2 transition-all">
                <span>Select a test suite</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="group hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
            onClick={onSelectDatabase}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 mb-3 group-hover:scale-110 transition-transform">
                <Database className="w-5 h-5 text-violet-600" />
              </div>
              <CardTitle className="text-base">Database Queries</CardTitle>
              <CardDescription className="text-sm">
                Execute SQL queries and view results in table format
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center text-xs text-blue-600 font-medium group-hover:gap-2 transition-all">
                <span>Open database panel</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tips */}
        <div className="mt-10 text-center">
          <p className="text-sm text-slate-400">
            <span className="font-medium">Tip:</span> Open a project folder and click "Scan APIs" to automatically discover API endpoints
          </p>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);
  const [selectedTestSuite, setSelectedTestSuite] = useState<TestSuite | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('welcome');

  const handleSelectEndpoint = (endpoint: APIEndpoint) => {
    setSelectedEndpoint(endpoint);
    setViewMode('request');
  };

  const handleSelectTestSuite = (suite: TestSuite) => {
    setSelectedTestSuite(suite);
    setViewMode('test-suite');
  };

  const handleSelectDatabase = () => {
    setViewMode('database');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          onSelectEndpoint={handleSelectEndpoint}
          onSelectTestSuite={handleSelectTestSuite}
          onSelectDatabase={handleSelectDatabase}
          selectedEndpointId={selectedEndpoint?.id}
        />

        <main className="flex-1 overflow-hidden">
          {viewMode === 'welcome' && (
            <WelcomeScreen onSelectDatabase={handleSelectDatabase} />
          )}

          {viewMode === 'request' && selectedEndpoint && (
            <RequestBuilder endpoint={selectedEndpoint} />
          )}

          {viewMode === 'test-suite' && selectedTestSuite && (
            <TestSuiteRunner testSuite={selectedTestSuite} />
          )}

          {viewMode === 'database' && <DatabaseQueryPanel />}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProjectProvider>
        <EnvironmentProvider>
          <TooltipProvider>
            <AppContent />
            <Toaster />
          </TooltipProvider>
        </EnvironmentProvider>
      </ProjectProvider>
    </QueryClientProvider>
  );
}

export default App;
