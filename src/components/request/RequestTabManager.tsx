import { useEffect, useMemo } from 'react';
import { APIEndpoint } from '@/types/api';
import { RequestBuilder } from './RequestBuilder';
import { RequestTabBar } from './RequestTabBar';
import { useRequestTabsStore } from '@/stores/requestTabsStore';
import { useProject } from '@/contexts/ProjectContext';

interface RequestTabManagerProps {
  onOpenEndpoint?: (openTab: (endpoint: APIEndpoint | null) => void) => void;
  onActiveEndpointChange?: (endpointId: string | undefined) => void;
}

export function RequestTabManager({ onOpenEndpoint, onActiveEndpointChange }: RequestTabManagerProps) {
  const { currentProject } = useProject();
  const {
    tabs,
    activeTabId,
    openTab,
    closeTab,
    setActiveTab,
    setProjectId,
  } = useRequestTabsStore();

  // Debug: Log when tabs or activeTabId changes
  useEffect(() => {
    console.log('[RequestTabManager] Store state changed:', {
      tabsCount: tabs.length,
      activeTabId,
      tabIds: tabs.map((t) => t.id),
    });
  }, [tabs.length, activeTabId]);

  // Sync project ID with store
  useEffect(() => {
    const projectId = currentProject?.id || null;
    setProjectId(projectId);
  }, [currentProject?.id, setProjectId]);

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
      onActiveEndpointChange(activeTab?.endpoint?.id || undefined);
    }
  }, [activeTabId, tabs, onActiveEndpointChange]);

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
          setActiveTab(tabs[nextIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, openTab, closeTab, setActiveTab]);

  // Calculate activeTab - ensure it recalculates when activeTabId or tabs change
  const activeTab = useMemo(() => {
    if (!activeTabId) {
      console.log('[RequestTabManager] No activeTabId, returning null');
      return null;
    }
    
    const foundTab = tabs.find((t) => t.id === activeTabId) || null;
    
    // Debug: Log when activeTab changes
    if (foundTab) {
      console.log('[RequestTabManager] activeTab calculated:', {
        tabId: foundTab.id,
        name: foundTab.name,
        method: foundTab.method,
        url: foundTab.url,
        hasEndpoint: !!foundTab.endpoint,
        endpointId: foundTab.endpoint?.id,
        bodyJsonLength: foundTab.bodyJson?.length || 0,
        headersJsonLength: foundTab.headersJson?.length || 0,
      });
    } else {
      console.warn('[RequestTabManager] Tab not found for activeTabId:', activeTabId, 'Available tabs:', tabs.map((t) => t.id));
    }
    
    return foundTab;
  }, [tabs, activeTabId]);

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

  // Debug: Log when activeTab changes for rendering
  useEffect(() => {
    if (activeTab) {
      console.log('[RequestTabManager] Rendering RequestBuilder with tab:', {
        tabId: activeTab.id,
        name: activeTab.name,
        method: activeTab.method,
        url: activeTab.url,
        hasEndpoint: !!activeTab.endpoint,
      });
    } else {
      console.log('[RequestTabManager] No activeTab to render');
    }
  }, [activeTab?.id]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <RequestTabBar />
      {activeTab && (
        <div className="flex-1 overflow-hidden">
          <RequestBuilder key={activeTab.id} tab={activeTab} />
        </div>
      )}
    </div>
  );
}
