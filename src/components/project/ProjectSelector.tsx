import { useState } from 'react';
import {
  FolderOpen,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  Loader2,
  Search,
  FolderCode,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useProject } from '@/contexts/ProjectContext';
import { Project } from '@/types/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function ProjectSelector() {
  const {
    projects,
    currentProject,
    isLoading,
    isScanning,
    selectProject,
    openFolder,
    createProject,
    deleteProject,
    scanProject,
  } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleOpenFolder = async () => {
    try {
      const path = await openFolder();
      if (path) {
        // Check if project already exists
        const existing = projects.find(p => p.path === path);
        if (existing) {
          selectProject(existing);
          toast({
            title: 'Project selected',
            description: `Switched to ${existing.name}`,
          });
        } else {
          const project = await createProject(path);
          toast({
            title: 'Project created',
            description: `Created project: ${project.name}`,
          });
        }
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to open folder',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    try {
      await deleteProject(project.id);
      toast({
        title: 'Project deleted',
        description: `Deleted project: ${project.name}`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete project',
        variant: 'destructive',
      });
    }
  };

  const handleScanProject = async () => {
    if (!currentProject) return;
    
    try {
      const endpoints = await scanProject();
      toast({
        title: 'Scan completed',
        description: `Found ${endpoints.length} API endpoints`,
      });
    } catch (err) {
      toast({
        title: 'Scan failed',
        description: err instanceof Error ? err.message : 'Failed to scan project',
        variant: 'destructive',
      });
    }
  };

  const formatLastScanned = (timestamp: number | null): string => {
    if (!timestamp) return 'Never scanned';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading...</span>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 min-w-[180px] justify-between"
          >
            <div className="flex items-center gap-2">
              <FolderCode className="w-4 h-4 text-blue-500" />
              <span className="truncate max-w-[120px]">
                {currentProject?.name || 'Select Project'}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[280px]">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Projects</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleOpenFolder}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {projects.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-slate-500">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p>No projects yet</p>
              <Button
                variant="link"
                size="sm"
                onClick={handleOpenFolder}
                className="text-blue-500 mt-1"
              >
                Open a folder
              </Button>
            </div>
          ) : (
            <ScrollArea className="max-h-[240px]">
              {projects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  className={cn(
                    'flex items-center justify-between cursor-pointer py-2',
                    currentProject?.id === project.id && 'bg-blue-50'
                  )}
                  onClick={() => {
                    selectProject(project);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {currentProject?.id === project.id && (
                        <Check className="w-4 h-4 text-blue-500 shrink-0" />
                      )}
                      <span className="truncate font-medium">{project.name}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{formatLastScanned(project.lastScanned)}</span>
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 hover:text-red-500 hover:bg-red-50"
                        onClick={(e) => handleDeleteProject(e, project)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete project</TooltipContent>
                  </Tooltip>
                </DropdownMenuItem>
              ))}
            </ScrollArea>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-blue-600 focus:text-blue-700"
            onClick={handleOpenFolder}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Open Folder...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Scan Button */}
      {currentProject && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              onClick={handleScanProject}
              disabled={isScanning}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Scan APIs</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Scan project to find API endpoints</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

