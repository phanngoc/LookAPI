import { useState, useMemo } from 'react';
import {
  Search,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  FileJson,
  FolderCode,
  SearchX,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { MethodBadge } from '@/components/shared/MethodBadge';
import { useEndpoints } from '@/hooks/useEndpoints';
import { useProject } from '@/contexts/ProjectContext';
import { APIEndpoint } from '@/types/api';
import { TestScenario } from '@/types/scenario';
import { ScenarioList } from '@/components/scenario/ScenarioList';
import { cn } from '@/lib/utils';
import { FeatureType } from './PrimaryNavigation';

interface SidebarProps {
  featureMode: FeatureType | null;
  onSelectEndpoint: (endpoint: APIEndpoint) => void;
  onSelectScenario: (scenario: TestScenario | null) => void;
  selectedEndpointId?: string;
  selectedScenario: TestScenario | null;
  projectId?: string;
}

export function Sidebar({
  featureMode,
  onSelectEndpoint,
  onSelectScenario,
  selectedEndpointId,
  selectedScenario,
  projectId,
}: SidebarProps) {
  const { currentProject, isScanning } = useProject();
  const { endpoints, isLoading: endpointsLoading } = useEndpoints(currentProject?.id);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['API Endpoints'])
  );

  // Group endpoints by category
  const endpointsByCategory = useMemo(() => {
    const grouped: Record<string, APIEndpoint[]> = {};
    endpoints.forEach((endpoint) => {
      if (!grouped[endpoint.category]) {
        grouped[endpoint.category] = [];
      }
      grouped[endpoint.category].push(endpoint);
    });
    return grouped;
  }, [endpoints]);

  // Filter endpoints by search query
  const filteredEndpoints = useMemo(() => {
    if (!searchQuery.trim()) return endpoints;

    const query = searchQuery.toLowerCase();
    return endpoints.filter(
      (endpoint) =>
        endpoint.name.toLowerCase().includes(query) ||
        endpoint.path.toLowerCase().includes(query) ||
        endpoint.method.toLowerCase().includes(query) ||
        endpoint.description.toLowerCase().includes(query)
    );
  }, [endpoints, searchQuery]);

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return Object.keys(endpointsByCategory);
    
    const matchingCategories = new Set<string>();
    filteredEndpoints.forEach((ep) => matchingCategories.add(ep.category));
    return Array.from(matchingCategories);
  }, [searchQuery, endpointsByCategory, filteredEndpoints]);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Don't render sidebar for database mode
  if (featureMode === 'database') {
    return null;
  }

  // Scenario mode - show ScenarioList
  if (featureMode === 'scenario') {
    if (!projectId) {
      return (
        <div className="w-72 border-r border-slate-200 bg-gradient-sidebar flex flex-col h-full">
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <FolderCode className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <h3 className="text-sm font-medium text-slate-700 mb-1">No Project Selected</h3>
              <p className="text-xs text-slate-500">
                Select a project from the header to view scenarios
              </p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="w-72 border-r border-slate-200 bg-gradient-sidebar flex flex-col h-full">
        <ScenarioList
          projectId={projectId}
          selectedScenario={selectedScenario}
          onSelectScenario={onSelectScenario}
        />
      </div>
    );
  }

  // Loading state for API mode
  if (endpointsLoading || isScanning) {
    return (
      <div className="w-72 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-9 bg-slate-100 rounded-lg" />
            <div className="h-6 bg-slate-100 rounded w-3/4" />
            <div className="h-6 bg-slate-100 rounded w-1/2" />
          </div>
          {isScanning && (
            <div className="mt-4 text-center text-sm text-slate-500">
              Scanning project...
            </div>
          )}
        </div>
      </div>
    );
  }

  // No project selected state for API mode
  if (!currentProject) {
    return (
      <div className="w-72 border-r border-slate-200 bg-gradient-sidebar flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <FolderCode className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-sm font-medium text-slate-700 mb-1">No Project Selected</h3>
            <p className="text-xs text-slate-500">
              Select a project from the header to view API endpoints
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Project selected but no endpoints
  if (endpoints.length === 0) {
    return (
      <div className="w-72 border-r border-slate-200 bg-gradient-sidebar flex flex-col h-full">
        <div className="p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search endpoints..."
              disabled
              className="pl-9 h-9 bg-slate-50 border-slate-200"
            />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <SearchX className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-sm font-medium text-slate-700 mb-1">No Endpoints Found</h3>
            <p className="text-xs text-slate-500 mb-3">
              Click "Scan APIs" in the header to scan this project for API endpoints
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 border-r border-slate-200 bg-gradient-sidebar flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Search endpoints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* API Endpoints */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <FileJson className="w-3.5 h-3.5" />
              <span>API Endpoints</span>
            </div>

            {searchQuery ? (
              /* Show filtered endpoints */
              <div className="space-y-0.5">
                {filteredEndpoints.map((endpoint) => (
                  <Button
                    key={endpoint.id}
                    variant="ghost"
                    className={cn(
                      'w-full justify-start gap-2 h-auto py-2 px-3 text-sm font-normal',
                      selectedEndpointId === endpoint.id
                        ? 'bg-blue-50 hover:bg-blue-100'
                        : 'hover:bg-slate-100'
                    )}
                    onClick={() => onSelectEndpoint(endpoint)}
                  >
                    <MethodBadge method={endpoint.method} className="text-[10px] px-1.5" />
                    <div className="flex-1 text-left overflow-hidden">
                      <div className="text-slate-700 truncate">{endpoint.name}</div>
                      <div className="text-xs text-slate-400 truncate font-mono">
                        {endpoint.path}
                      </div>
                    </div>
                  </Button>
                ))}
                {filteredEndpoints.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-slate-400">
                    No endpoints found
                  </div>
                )}
              </div>
            ) : (
              /* Show grouped by category */
              <div className="space-y-0.5">
                {filteredCategories.map((category) => (
                  <Collapsible
                    key={category}
                    open={expandedCategories.has(category)}
                    onOpenChange={() => toggleCategory(category)}
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                      {expandedCategories.has(category) ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                      <FolderOpen className="w-4 h-4 text-blue-500" />
                      <span className="flex-1 text-left">{category}</span>
                      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {endpointsByCategory[category]?.length || 0}
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-4">
                      <div className="space-y-0.5 mt-1">
                        {endpointsByCategory[category]?.map((endpoint) => (
                          <Button
                            key={endpoint.id}
                            variant="ghost"
                            className={cn(
                              'w-full justify-start gap-2 h-auto py-2 px-3 text-sm font-normal',
                              selectedEndpointId === endpoint.id
                                ? 'bg-blue-50 hover:bg-blue-100'
                                : 'hover:bg-slate-100'
                            )}
                            onClick={() => onSelectEndpoint(endpoint)}
                          >
                            <MethodBadge
                              method={endpoint.method}
                              className="text-[10px] px-1.5"
                            />
                            <div className="flex-1 text-left overflow-hidden">
                              <div className="text-slate-700 truncate">
                                {endpoint.name}
                              </div>
                              <div className="text-xs text-slate-400 truncate font-mono">
                                {endpoint.path}
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

