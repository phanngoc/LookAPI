import { useState, useEffect } from 'react';
import { Settings, FolderOpen, Globe, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useProject } from '@/contexts/ProjectContext';
import { toast } from '@/hooks/use-toast';
import { isValidUrl } from '@/utils/url';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { currentProject, updateProjectBaseUrl } = useProject();
  const [baseUrl, setBaseUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Initialize baseUrl when dialog opens or project changes
  useEffect(() => {
    if (open && currentProject) {
      setBaseUrl(currentProject.baseUrl || '');
      setUrlError(null);
    }
  }, [open, currentProject]);

  const handleBaseUrlChange = (value: string) => {
    setBaseUrl(value);
    
    // Validate URL
    if (value && !isValidUrl(value)) {
      setUrlError('Please enter a valid URL (e.g., http://localhost:8080)');
    } else {
      setUrlError(null);
    }
  };

  const handleSave = async () => {
    if (!currentProject) return;
    
    // Validate before saving
    if (baseUrl && !isValidUrl(baseUrl)) {
      setUrlError('Please enter a valid URL');
      return;
    }

    setIsSaving(true);
    try {
      // Send null if empty, otherwise send the URL
      await updateProjectBaseUrl(currentProject.id, baseUrl.trim() || null);
      
      toast({
        title: 'Settings saved',
        description: baseUrl 
          ? `Base URL set to ${baseUrl}` 
          : 'Base URL cleared (using environment default)',
        variant: 'success',
      });
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Failed to save settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original value
    setBaseUrl(currentProject?.baseUrl || '');
    setUrlError(null);
    onOpenChange(false);
  };

  if (!currentProject) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Settings
            </DialogTitle>
            <DialogDescription>
              No project selected. Please select a project first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Project Settings
          </DialogTitle>
          <DialogDescription>
            Configure settings for the current project
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Project Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-700">Project Information</h4>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <FolderOpen className="w-4 h-4 text-slate-500" />
                <span className="font-medium">{currentProject.name}</span>
              </div>
              <p className="text-xs text-slate-500 truncate pl-6" title={currentProject.path}>
                {currentProject.path}
              </p>
            </div>
          </div>

          <Separator />

          {/* Base URL Setting */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-500" />
              <h4 className="text-sm font-medium text-slate-700">Base URL</h4>
            </div>
            <p className="text-xs text-slate-500">
              Set a custom base URL for all API requests in this project. 
              This will override the environment BASE_URL variable.
            </p>
            <Input
              placeholder="http://localhost:8080"
              value={baseUrl}
              onChange={(e) => handleBaseUrlChange(e.target.value)}
              className={urlError ? 'border-red-300 focus-visible:ring-red-500' : ''}
            />
            {urlError && (
              <p className="text-xs text-red-500">{urlError}</p>
            )}
            <p className="text-xs text-slate-400">
              Leave empty to use the environment variable or default URL
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !!urlError}>
            <Save className="w-4 h-4 mr-1.5" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
