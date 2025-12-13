import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { APIEndpoint } from '@/types/api';
import { RequestTab } from '@/types/requestTab';
import { tauriService } from '@/services/tauri';
import { getBaseUrlForProject, buildFullUrl } from '@/utils/url';
import { useProject } from '@/contexts/ProjectContext';
import { useEnvironment } from '@/contexts/EnvironmentContext';

interface Dependencies {
  currentProject: any;
  getVariable: (key: string) => string | undefined;
  ensureProjectExists: (project: any) => Promise<void>;
  resolveVariables: (text: string) => string;
}

interface RequestTabsStore {
  // State
  tabs: RequestTab[];
  activeTabId: string | null;
  projectId: string | null;

  // Internal state for debouncing
  saveTimeouts: Map<string, ReturnType<typeof setTimeout>>;
  activeTabIdTimeout: ReturnType<typeof setTimeout> | null;

  // Actions (internal - require dependencies)
  _openTab: (endpoint: APIEndpoint | null, deps: Dependencies) => string;
  closeTab: (tabId: string) => void;
  _updateTab: (tabId: string, updates: Partial<RequestTab>, deps: Dependencies) => void;
  _setActiveTab: (tabId: string | null, deps: Dependencies) => void;
  _reorderTabs: (fromIndex: number, toIndex: number, deps: Dependencies) => void;
  renameTab: (tabId: string, name: string) => void;
  _executeRequest: (tabId: string, deps: Dependencies) => Promise<void>;
  loadTabs: (projectId: string | null) => Promise<void>;
  reset: () => void;
  setProjectId: (projectId: string | null) => void;
}

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
async function loadTabsFromDatabase(projectId: string | null): Promise<{ tabs: RequestTab[]; activeTabId: string | null }> {
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

// Save a single tab to database (without responses)
async function saveSingleTabToDatabase(
  projectId: string | null,
  tab: RequestTab,
  tabOrder: number,
  currentProject: any,
  ensureProjectExists: (project: any) => Promise<void>
): Promise<void> {
  if (!projectId) {
    return;
  }

  // Validate projectId matches currentProject.id
  if (currentProject && projectId !== currentProject.id) {
    console.warn('Project ID mismatch:', {
      projectId,
      currentProjectId: currentProject.id,
      currentProject
    });
    return;
  }

  // Ensure project exists BEFORE saving tab
  if (currentProject && projectId === currentProject.id) {
    try {
      await ensureProjectExists(currentProject);
    } catch (err) {
      console.error('Failed to ensure project exists proactively:', err);
      // Continue anyway, let save_request_tab handle it
    }
  }

  try {
    // Clean tab before saving (remove responses and executing state)
    const cleanedTab: RequestTab = {
      ...tab,
      response: null, // Don't save responses
      isExecuting: false, // Don't save executing state
    };

    await tauriService.saveRequestTab(projectId, cleanedTab, tabOrder);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Handle FOREIGN KEY errors by ensuring project exists and retrying
    if (errorMessage.includes('FOREIGN KEY') || errorMessage.includes('does not exist')) {
      if (currentProject && projectId === currentProject.id) {
        try {
          console.warn('FOREIGN KEY error detected, retrying after ensuring project exists...', {
            projectId,
            tabId: tab.id,
            error: errorMessage
          });
          
          // Ensure project exists again (in case of race condition)
          await ensureProjectExists(currentProject);
          
          // Small delay to ensure transaction is committed
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Retry saving tab after ensuring project exists
          const cleanedTab: RequestTab = {
            ...tab,
            response: null,
            isExecuting: false,
          };
          
          await tauriService.saveRequestTab(projectId, cleanedTab, tabOrder);
          console.log('Successfully saved tab after retry');
        } catch (retryError) {
          const retryErrorMessage = retryError instanceof Error ? retryError.message : String(retryError);
          console.error('Failed to save tab after ensuring project exists:', {
            originalError: errorMessage,
            retryError: retryErrorMessage,
            projectId,
            tabId: tab.id,
            currentProject: currentProject ? { id: currentProject.id, name: currentProject.name } : null
          });
          // Don't throw - allow user to continue working
        }
      } else {
        console.warn('Failed to save tab: Project may not exist in database and no valid currentProject available', {
          projectId,
          tabId: tab.id,
          hasCurrentProject: !!currentProject,
          projectIdMatch: currentProject ? projectId === currentProject.id : false,
          error: errorMessage
        });
      }
      return;
    }
    
    console.error('Failed to save tab to database:', {
      error: errorMessage,
      projectId,
      tabId: tab.id,
      hasCurrentProject: !!currentProject
    });
  }
}

const useRequestTabsStoreBase = create<RequestTabsStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    tabs: [],
    activeTabId: null,
    projectId: null,
    saveTimeouts: new Map(),
    activeTabIdTimeout: null,

    // Set project ID and auto-load tabs
    setProjectId: (projectId: string | null) => {
      const currentProjectId = get().projectId;
      if (currentProjectId === projectId) return;

      // Cleanup timeouts when project changes
      const { saveTimeouts, activeTabIdTimeout } = get();
      saveTimeouts.forEach((timeout) => clearTimeout(timeout));
      saveTimeouts.clear();
      if (activeTabIdTimeout) {
        clearTimeout(activeTabIdTimeout);
      }

      set({ projectId });
      // Auto-load tabs when project changes
      get().loadTabs(projectId);
    },

    // Load tabs from database
    loadTabs: async (projectId: string | null) => {
      const loaded = await loadTabsFromDatabase(projectId);
      
      set({
        tabs: loaded.tabs,
        activeTabId: loaded.activeTabId && loaded.tabs.find((t) => t.id === loaded.activeTabId)
          ? loaded.activeTabId
          : loaded.tabs.length > 0
          ? loaded.tabs[0].id
          : null,
      });
    },

    // Open a new tab or switch to existing one (internal)
    _openTab: (endpoint, deps) => {
      const { tabs, projectId } = get();
      const { currentProject, getVariable, ensureProjectExists } = deps;

      if (!endpoint) {
        // Create empty tab
        const newTab = createEmptyTab();
        const newTabs = [...tabs, newTab];
        
        set({ tabs: newTabs, activeTabId: newTab.id });
        
        // Save new tab after state update
        if (projectId && currentProject) {
          setTimeout(() => {
            saveSingleTabToDatabase(
              projectId,
              newTab,
              newTabs.length - 1,
              currentProject,
              ensureProjectExists
            );
          }, 100);
        }
        
        return newTab.id;
      }

      // Check if tab already exists for this endpoint
      const existingTab = tabs.find((t) => t.endpoint?.id === endpoint.id);
      if (existingTab) {
        set({ activeTabId: existingTab.id });
        return existingTab.id;
      }

      // Create new tab
      const newTab = createTabFromEndpoint(endpoint, currentProject, getVariable);
      const newTabs = [...tabs, newTab];
      
      set({ tabs: newTabs, activeTabId: newTab.id });
      
      // Save new tab after state update
      if (projectId && currentProject) {
        setTimeout(() => {
          saveSingleTabToDatabase(
            projectId,
            newTab,
            newTabs.length - 1,
            currentProject,
            ensureProjectExists
          );
        }, 100);
      }
      
      return newTab.id;
    },

    // Close a tab
    closeTab: (tabId: string) => {
      const { tabs, activeTabId, saveTimeouts } = get();
      const newTabs = tabs.filter((t) => t.id !== tabId);
      
      // Cleanup timeout for closed tab
      const timeout = saveTimeouts.get(tabId);
      if (timeout) {
        clearTimeout(timeout);
        saveTimeouts.delete(tabId);
      }

      // If closing active tab, switch to another
      let newActiveTabId = activeTabId;
      if (activeTabId === tabId) {
        const closedIndex = tabs.findIndex((t) => t.id === tabId);
        if (newTabs.length > 0) {
          // Switch to next tab, or previous if closing last tab
          const nextIndex = closedIndex < newTabs.length ? closedIndex : newTabs.length - 1;
          newActiveTabId = newTabs[nextIndex].id;
        } else {
          newActiveTabId = null;
        }
      }

      set({ tabs: newTabs, activeTabId: newActiveTabId });
    },

    // Update a tab with debouncing (internal)
    _updateTab: (tabId, updates, deps) => {
      const { tabs, projectId, saveTimeouts } = get();
      const { currentProject, ensureProjectExists } = deps;
      
      const updatedTabs = tabs.map((tab) =>
        tab.id === tabId
          ? { ...tab, ...updates, updatedAt: Date.now() }
          : tab
      );
      
      set({ tabs: updatedTabs });
      
      // Find the updated tab and save it (debounced)
      const updatedTab = updatedTabs.find((t) => t.id === tabId);
      if (updatedTab && projectId && currentProject) {
        // Clear existing timeout for this tab
        const existingTimeout = saveTimeouts.get(tabId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }
        
        // Calculate tab order
        const tabOrder = updatedTabs.findIndex((t) => t.id === tabId);
        
        // Set new timeout to save this tab
        const timeout = setTimeout(() => {
          saveSingleTabToDatabase(
            projectId,
            updatedTab,
            tabOrder,
            currentProject,
            ensureProjectExists
          );
          saveTimeouts.delete(tabId);
        }, 500);
        
        saveTimeouts.set(tabId, timeout);
      }
    },

    // Set active tab with debouncing (internal)
    _setActiveTab: (tabId, deps) => {
      const { projectId, activeTabIdTimeout, tabs } = get();
      const { currentProject } = deps;
      
      // Debug: Log tab switch
      const tab = tabs.find((t) => t.id === tabId);
      console.log('[requestTabsStore] _setActiveTab called:', {
        tabId,
        tabName: tab?.name,
        tabMethod: tab?.method,
        tabUrl: tab?.url,
        hasEndpoint: !!tab?.endpoint,
        tabsCount: tabs.length,
      });
      
      set({ activeTabId: tabId });
      
      // Save activeTabId when it changes (debounced)
      if (projectId && currentProject) {
        if (activeTabIdTimeout) {
          clearTimeout(activeTabIdTimeout);
        }
        
        const timeout = setTimeout(() => {
          tauriService.saveRequestTabState(projectId, tabId).catch((err) => {
            console.error('Failed to save active tab state:', err);
          });
        }, 300);
        
        set({ activeTabIdTimeout: timeout });
      }
    },

    // Reorder tabs (internal)
    _reorderTabs: (fromIndex, toIndex, deps) => {
      const { tabs, projectId } = get();
      const { currentProject } = deps;
      const newTabs = [...tabs];
      const [moved] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, moved);
      
      set({ tabs: newTabs });
      
      // Save all tabs with new order (only when reordering)
      if (projectId && currentProject) {
        setTimeout(() => {
          newTabs.forEach((tab, index) => {
            const cleanedTab: RequestTab = {
              ...tab,
              response: null,
              isExecuting: false,
            };
            tauriService.saveRequestTab(projectId, cleanedTab, index).catch((err) => {
              console.error(`Failed to save tab ${tab.id} after reorder:`, err);
            });
          });
        }, 300);
      }
    },

    // Rename a tab
    renameTab: (tabId, name) => {
      const { tabs } = get();
      const updatedTabs = tabs.map((tab) =>
        tab.id === tabId ? { ...tab, name, updatedAt: Date.now() } : tab
      );
      set({ tabs: updatedTabs });
      // Note: Actual save will be handled by updateTab when called from component
    },

    // Execute API request (internal)
    _executeRequest: async (tabId, deps) => {
      const { tabs, _updateTab } = get();
      const { resolveVariables } = deps;
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;

      // Set executing state (without saving to DB)
      const updatedTabs = tabs.map((t) =>
        t.id === tabId ? { ...t, isExecuting: true, error: null } : t
      );
      set({ tabs: updatedTabs });

      try {
        // Parse body
        let parameters = {};
        if (tab.bodyJson.trim()) {
          try {
            parameters = JSON.parse(tab.bodyJson);
          } catch {
            _updateTab(tabId, {
              error: 'Invalid JSON in request body',
              isExecuting: false,
            }, deps);
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

        _updateTab(tabId, {
          response: result,
          curlCommand: curl,
          isExecuting: false,
          error: null,
        }, deps);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        _updateTab(tabId, {
          error: errorMessage || 'Request failed',
          isExecuting: false,
        }, deps);
      }
    },

    // Reset store
    reset: () => {
      const { saveTimeouts, activeTabIdTimeout } = get();
      saveTimeouts.forEach((timeout) => clearTimeout(timeout));
      saveTimeouts.clear();
      if (activeTabIdTimeout) {
        clearTimeout(activeTabIdTimeout);
      }
      
      set({
        tabs: [],
        activeTabId: null,
        projectId: null,
        saveTimeouts: new Map(),
        activeTabIdTimeout: null,
      });
    },
  }))
);

// Hook wrapper that automatically injects dependencies from contexts
export function useRequestTabsStore() {
  const { currentProject, ensureProjectExists } = useProject();
  const { getVariable, resolveVariables } = useEnvironment();
  
  // Use selectors to ensure proper re-renders
  const tabs = useRequestTabsStoreBase((state) => state.tabs);
  const activeTabId = useRequestTabsStoreBase((state) => state.activeTabId);
  const projectId = useRequestTabsStoreBase((state) => state.projectId);
  
  // Get actions
  const _openTab = useRequestTabsStoreBase((state) => state._openTab);
  const closeTab = useRequestTabsStoreBase((state) => state.closeTab);
  const _updateTab = useRequestTabsStoreBase((state) => state._updateTab);
  const _setActiveTab = useRequestTabsStoreBase((state) => state._setActiveTab);
  const _reorderTabs = useRequestTabsStoreBase((state) => state._reorderTabs);
  const renameTab = useRequestTabsStoreBase((state) => state.renameTab);
  const _executeRequest = useRequestTabsStoreBase((state) => state._executeRequest);
  const loadTabs = useRequestTabsStoreBase((state) => state.loadTabs);
  const reset = useRequestTabsStoreBase((state) => state.reset);
  const setProjectId = useRequestTabsStoreBase((state) => state.setProjectId);

  const deps: Dependencies = {
    currentProject,
    getVariable,
    ensureProjectExists,
    resolveVariables,
  };

  return {
    // State
    tabs,
    activeTabId,
    projectId,

    // Actions with dependencies injected
    openTab: (endpoint: APIEndpoint | null) => _openTab(endpoint, deps),
    closeTab,
    updateTab: (tabId: string, updates: Partial<RequestTab>) => _updateTab(tabId, updates, deps),
    setActiveTab: (tabId: string | null) => _setActiveTab(tabId, deps),
    reorderTabs: (fromIndex: number, toIndex: number) => _reorderTabs(fromIndex, toIndex, deps),
    renameTab,
    executeRequest: (tabId: string) => _executeRequest(tabId, deps),
    loadTabs,
    reset,
    setProjectId,
  };
}
