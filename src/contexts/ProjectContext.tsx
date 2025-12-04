import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Project, APIEndpoint } from '@/types/api';
import { tauriService } from '@/services/tauri';
import { useQueryClient } from '@tanstack/react-query';

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  isScanning: boolean;
  error: string | null;
  selectProject: (project: Project | null) => void;
  openFolder: () => Promise<string | null>;
  createProject: (path: string) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  scanProject: () => Promise<APIEndpoint[]>;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const ACTIVE_PROJECT_KEY = 'api-tester-active-project';

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Restore active project from localStorage or auto-select first project
  useEffect(() => {
    if (projects.length === 0) return;
    
    const storedProjectId = localStorage.getItem(ACTIVE_PROJECT_KEY);
    if (storedProjectId) {
      const project = projects.find(p => p.id === storedProjectId);
      if (project) {
        setCurrentProject(project);
        return;
      }
    }
    
    // Auto-select first project if no stored project or stored project doesn't exist
    // Only set if currentProject is null to avoid overwriting user selection
    setCurrentProject(prev => prev || projects[0] || null);
  }, [projects]);

  // Persist active project to localStorage
  useEffect(() => {
    if (currentProject) {
      localStorage.setItem(ACTIVE_PROJECT_KEY, currentProject.id);
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  }, [currentProject]);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const loadedProjects = await tauriService.getAllProjects();
      setProjects(loadedProjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProjects = useCallback(async () => {
    await loadProjects();
  }, []);

  const selectProject = useCallback((project: Project | null) => {
    setCurrentProject(project);
    // Invalidate endpoints query when project changes
    queryClient.invalidateQueries({ queryKey: ['endpoints'] });
  }, [queryClient]);

  const openFolder = useCallback(async (): Promise<string | null> => {
    try {
      const path = await tauriService.openFolderDialog();
      return path;
    } catch (err) {
      console.error('Failed to open folder dialog:', err);
      return null;
    }
  }, []);

  const createProject = useCallback(async (path: string): Promise<Project> => {
    try {
      setError(null);
      const project = await tauriService.createProject(path);
      setProjects(prev => [project, ...prev]);
      setCurrentProject(project);
      return project;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create project';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, []);

  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    try {
      setError(null);
      await tauriService.deleteProject(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
      }
      // Invalidate endpoints query
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete project';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentProject, queryClient]);

  const scanProject = useCallback(async (): Promise<APIEndpoint[]> => {
    if (!currentProject) {
      throw new Error('No project selected');
    }

    try {
      setIsScanning(true);
      setError(null);
      const endpoints = await tauriService.scanProject(currentProject.id, currentProject.path);
      
      // Update project's lastScanned timestamp
      const updatedProject = { ...currentProject, lastScanned: Date.now() };
      setCurrentProject(updatedProject);
      setProjects(prev => prev.map(p => p.id === currentProject.id ? updatedProject : p));
      
      // Invalidate endpoints query to refresh the sidebar
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
      
      return endpoints;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to scan project';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsScanning(false);
    }
  }, [currentProject, queryClient]);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject,
        isLoading,
        isScanning,
        error,
        selectProject,
        openFolder,
        createProject,
        deleteProject,
        scanProject,
        refreshProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

