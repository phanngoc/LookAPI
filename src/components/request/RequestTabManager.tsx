import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { APIEndpoint } from '@/types/api';
import { RequestTab, RequestTabState } from '@/types/requestTab';
import { RequestBuilder } from './RequestBuilder';
import { RequestTabBar } from './RequestTabBar';
import { useProject } from '@/contexts/ProjectContext';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import { getBaseUrlForProject, buildFullUrl } from '@/utils/url';
import { tauriService } from '@/services/tauri';

// Helper function to create a new tab from an endpoint
function createTabFromEndpoint(
  endpoint: APIEndpoint,
  currentProject: any,
  getVariable: (key: string) => string | undefined
): RequestTab {
  const now = Date.now();
  const envBaseUrl = getVariable('BASE_URL');
  const baseUrl = getBaseUrlForProject(currentProject, envBaseUrl, endpoint.service);
  const url = buildFullUrl(baseUrl, endpoint.path);

  // Build body from parameters
  const params = endpoint.parameters.reduce((acc, param) => {
    acc[param.name] = param.defaultValue ?? param.example ?? '';
    return acc;
  }, {} as Record<string, unknown>);

  return {
    id: `tab-${now}-${Math.random().toString(36).substr(2, 9)}`,
    endpoint,
    method: endpoint.method,
    url,
    bodyJson: JSON.stringify(params, null, 2),
    headersJson: '{\n  "Content-Type": "application/json"\n}',
    response: null,
    error: null,
    isExecuting: false,
    activeTab: 'body',
    name: `${endpoint.method} ${endpoint.path}`,
    createdAt: now,
    updatedAt: now,
  };
}

// Helper function to create an empty tab
function createEmptyTab(): RequestTab {
  const now = Date.now();
  return {
    id: `tab-${now}-${Math.random().toString(36).substr(2, 9)}`,
    endpoint: null,
    method: 'GET',
    url: '',
    bodyJson: '{}',
    headersJson: '{\n  "Content-Type": "application/json"\n}',
    response: null,
    error: null,
    isExecuting: false,
    activeTab: 'body',
    name: 'New Request',
    createdAt: now,
    updatedAt: now,
  };
}

// Load tabs from database
async function loadTabsFromDatabase(projectId: string | null): Promise<RequestTabState> {
  if (!projectId) {
    return { tabs: [], activeTabId: null };
  }

  try {
    const tabs = await tauriService.getRequestTabs(projectId);
    // Clean up tabs (remove responses as they can be large)
    const cleanedTabs = tabs.map((tab) => ({
      ...tab,
      response: null, // Don't restore responses
      isExecuting: false, // Don't restore executing state
    }));

    const activeTabId = await tauriService.getRequestTabState(projectId);

    return {
      tabs: cleanedTabs,
      activeTabId: activeTabId || null,
    };
  } catch (error) {
    console.error('Failed to load tabs from database:', error);
    return { tabs: [], activeTabId: null };
  }
}

// Save tabs to database (without responses)
async function saveTabsToDatabase(projectId: string | null, state: RequestTabState): Promise<void> {
  if (!projectId) {
    return;
  }

  try {
    // Clean tabs before saving (remove responses and executing state)
    const cleanedTabs = state.tabs.map((tab) => ({
      ...tab,
      response: null, // Don't save responses
      isExecuting: false, // Don't save executing state
    }));

    await tauriService.saveRequestTabs(projectId, cleanedTabs);
    await tauriService.saveRequestTabState(projectId, state.activeTabId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Only log warning for FOREIGN KEY errors, don't crash
    if (errorMessage.includes('FOREIGN KEY') || errorMessage.includes('does not exist')) {
      console.warn('Failed to save tabs: Project may not exist in database yet', error);
      // Don't throw - allow user to continue working
      return;
    }
    
    console.error('Failed to save tabs to database:', error);
  }
}

interface RequestTabManagerProps {
  onOpenEndpoint?: (openTab: (endpoint: APIEndpoint | null) => void) => void;
  onActiveEndpointChange?: (endpointId: string | null) => void;
}

export function RequestTabManager({ onOpenEndpoint, onActiveEndpointChange }: RequestTabManagerProps) {
  const { currentProject } = useProject();
  const { getVariable } = useEnvironment();
  const [tabs, setTabs] = useState<RequestTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectId = currentProject?.id || null;

  // Define openTab BEFORE useEffect that uses it
  const openTab = useCallback(
    (endpoint: APIEndpoint | null) => {
      if (!endpoint) {
        // Create empty tab
        const newTab = createEmptyTab();
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
        return newTab.id;
      }

      // Check if tab already exists for this endpoint
      // Use functional update to access current tabs state
      let resultTabId: string | undefined;
      setTabs((prev) => {
        const existingTab = prev.find((t) => t.endpoint?.id === endpoint.id);
        if (existingTab) {
          resultTabId = existingTab.id;
          setActiveTabId(existingTab.id);
          return prev;
        }

        // Create new tab
        const newTab = createTabFromEndpoint(endpoint, currentProject, getVariable);
        resultTabId = newTab.id;
        setActiveTabId(newTab.id);
        return [...prev, newTab];
      });
      return resultTabId!;
    },
    [currentProject, getVariable]
  );

  // Load tabs when project changes
  useEffect(() => {
    if (!projectId) {
      setTabs([]);
      setActiveTabId(null);
      return;
    }

    let cancelled = false;

    async function loadTabs() {
      const loaded = await loadTabsFromDatabase(projectId);
      if (cancelled) return;

      setTabs(loaded.tabs);
      if (loaded.activeTabId && loaded.tabs.find((t) => t.id === loaded.activeTabId)) {
        setActiveTabId(loaded.activeTabId);
      } else if (loaded.tabs.length > 0) {
        setActiveTabId(loaded.tabs[0].id);
      } else {
        setActiveTabId(null);
      }
    }

    loadTabs();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Save tabs when they change (debounced)
  useEffect(() => {
    if (!projectId || !currentProject) {
      return;
    }

    // Only save if we have a valid project
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveTabsToDatabase(projectId, { tabs, activeTabId });
    }, 500);
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [tabs, activeTabId, projectId, currentProject]);

  // Expose openTab function to parent via callback
  useEffect(() => {
    if (onOpenEndpoint) {
      onOpenEndpoint(openTab);
    }
  }, [onOpenEndpoint, openTab]);

  // Notify parent of active endpoint change
  useEffect(() => {
    if (onActiveEndpointChange) {
      const activeTab = tabs.find((t) => t.id === activeTabId);
      onActiveEndpointChange(activeTab?.endpoint?.id || null);
    }
  }, [activeTabId, tabs, onActiveEndpointChange]);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId);
      // If closing active tab, switch to another
      if (activeTabId === tabId) {
        const closedIndex = prev.findIndex((t) => t.id === tabId);
        if (newTabs.length > 0) {
          // Switch to next tab, or previous if closing last tab
          const nextIndex = closedIndex < newTabs.length ? closedIndex : newTabs.length - 1;
          setActiveTabId(newTabs[nextIndex].id);
        } else {
          setActiveTabId(null);
        }
      }
      return newTabs;
    });
  }, [activeTabId]);

  const updateTab = useCallback((tabId: string, updates: Partial<RequestTab>) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId
          ? { ...tab, ...updates, updatedAt: Date.now() }
          : tab
      )
    );
  }, []);

  const renameTab = useCallback((tabId: string, newName: string) => {
    updateTab(tabId, { name: newName });
  }, [updateTab]);

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setTabs((prev) => {
      const newTabs = [...prev];
      const [moved] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, moved);
      return newTabs;
    });
  }, []);

  const activeTab = useMemo(() => {
    if (!activeTabId) return null;
    return tabs.find((t) => t.id === activeTabId) || null;
  }, [tabs, activeTabId]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.key === 't' && !e.shiftKey) {
        e.preventDefault();
        openTab(null);
      } else if (modKey && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) {
          closeTab(activeTabId);
        }
      } else if (modKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
          const nextIndex = (currentIndex + 1) % tabs.length;
          setActiveTabId(tabs[nextIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, openTab, closeTab]);

  if (tabs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 mb-4">
            No requests open. Select an endpoint from the sidebar or create a new request.
          </p>
          <button
            onClick={() => openTab(null)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            New Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <RequestTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={closeTab}
        onRenameTab={renameTab}
        onReorderTabs={reorderTabs}
        onNewTab={() => openTab(null)}
      />
      {activeTab && (
        <div className="flex-1 overflow-hidden">
          <RequestBuilder key={activeTab.id} tab={activeTab} onUpdate={updateTab} />
        </div>
      )}
    </div>
  );
}
