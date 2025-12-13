import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { PrimaryNavigation, FeatureType } from '@/components/layout/PrimaryNavigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { RequestTabManager } from '@/components/request/RequestTabManager';
import { DatabaseQueryPanel } from '@/components/database/DatabaseQueryPanel';
import { ScenarioPanel } from '@/components/scenario/ScenarioPanel';
import { EnvironmentProvider } from '@/contexts/EnvironmentContext';
import { ProjectProvider, useProject } from '@/contexts/ProjectContext';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { APIEndpoint } from '@/types/api';
import { TestScenario } from '@/types/scenario';
import { useRequestTabsStore } from '@/stores/requestTabsStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});


function AppContent() {
  const [activeFeature, setActiveFeature] = useState<FeatureType | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(null);
  const [activeEndpointId, setActiveEndpointId] = useState<string | undefined>(undefined);
  const { currentProject } = useProject();
  const { openTab } = useRequestTabsStore();

  const handleSelectFeature = (feature: FeatureType) => {
    setActiveFeature(feature);
    // Reset selections when switching features
    setSelectedScenario(null);
  };

  const handleSelectEndpoint = (endpoint: APIEndpoint) => {
    // Tự động activate feature 'api' nếu chưa được set
    if (activeFeature !== 'api') {
      setActiveFeature('api');
    }
    // Open tab via store
    openTab(endpoint);
  };

  const handleSelectScenario = (scenario: TestScenario | null) => {
    setSelectedScenario(scenario);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        <PrimaryNavigation
          activeFeature={activeFeature}
          onSelectFeature={handleSelectFeature}
        />

        {activeFeature !== 'database' && (
          <Sidebar
            featureMode={activeFeature}
            onSelectEndpoint={handleSelectEndpoint}
            onSelectScenario={handleSelectScenario}
            selectedEndpointId={activeEndpointId}
            selectedScenario={selectedScenario}
            projectId={currentProject?.id}
          />
        )}

        <main className="flex-1 overflow-hidden">
          {!activeFeature && (
            <div className="h-full flex items-center justify-center bg-gradient-subtle">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-slate-900 mb-2">
                  Welcome to API Tester
                </h2>
                <p className="text-slate-500">
                  Select a feature from the left navigation to get started
                </p>
              </div>
            </div>
          )}

          {activeFeature === 'api' && (
            <RequestTabManager
              onActiveEndpointChange={setActiveEndpointId}
            />
          )}

          {activeFeature === 'database' && <DatabaseQueryPanel />}

          {activeFeature === 'scenario' && currentProject && (
            <ScenarioPanel
              projectId={currentProject.id}
              selectedScenario={selectedScenario}
            />
          )}

          {activeFeature === 'scenario' && !currentProject && (
            <div className="flex items-center justify-center h-full text-gray-500">
              Please select a project first to use Test Scenarios
            </div>
          )}
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
