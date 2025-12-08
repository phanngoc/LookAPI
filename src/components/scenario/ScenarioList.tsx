import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  ChevronRight,
  FlaskConical,
  Search,
  Download,
  Upload,
  FileCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTestScenarios, useScenarioYaml } from '@/hooks/useTestScenarios';
import { TestScenario, PRIORITY_COLORS } from '@/types/scenario';
import { YamlEditor } from './YamlEditor';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  projectId: string;
  selectedScenario: TestScenario | null;
  onSelectScenario: (scenario: TestScenario | null) => void;
}

export function ScenarioList({ projectId, selectedScenario, onSelectScenario }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importYamlContent, setImportYamlContent] = useState('');

  const { toast } = useToast();
  const {
    scenarios,
    isLoading,
    createScenario,
    deleteScenario,
    refetch,
    isCreating,
    isDeleting,
  } = useTestScenarios(projectId);

  const {
    exportProject,
    importProject,
    isExporting,
  } = useScenarioYaml(projectId);

  // Listen for scenario-created events to auto-refresh the list
  useEffect(() => {
    const handleScenarioCreated = (event: CustomEvent) => {
      if (event.detail.projectId === projectId) {
        console.log('[ScenarioList] Scenario created, refreshing list...');
        refetch();
      }
    };
    
    window.addEventListener('scenario-created', handleScenarioCreated as EventListener);
    return () => {
      window.removeEventListener('scenario-created', handleScenarioCreated as EventListener);
    };
  }, [projectId, refetch]);

  const filteredScenarios = scenarios.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const scenario = await createScenario({ name: newName });
      onSelectScenario(scenario);
      setNewName('');
      setShowCreate(false);
    } catch (e) {
      console.error('Failed to create scenario:', e);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (selectedScenario?.id === id) {
      onSelectScenario(null);
    }
    try {
      await deleteScenario(id);
    } catch (e) {
      console.error('Failed to delete scenario:', e);
    }
  };

  // Export all scenarios to YAML file
  const handleExportProject = async () => {
    try {
      const yaml = await exportProject();
      const blob = new Blob([yaml], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scenarios-export-${new Date().toISOString().split('T')[0]}.yaml`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: 'Exported Successfully',
        description: `${scenarios.length} scenario(s) exported to YAML file.`,
      });
    } catch (e) {
      toast({
        title: 'Export Error',
        description: e instanceof Error ? e.message : 'Failed to export scenarios',
        variant: 'destructive',
      });
    }
  };

  // Import scenarios from YAML
  const handleImportProject = async (yamlContent: string) => {
    try {
      const imported = await importProject(yamlContent);
      setShowImportDialog(false);
      setImportYamlContent('');
      await refetch();
      toast({
        title: 'Imported Successfully',
        description: `${imported.length} scenario(s) imported.`,
      });
    } catch (e) {
      toast({
        title: 'Import Error',
        description: e instanceof Error ? e.message : 'Failed to import scenarios',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200">
      {/* Search & Create */}
      <div className="p-3 border-b border-slate-200 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search scenarios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {showCreate ? (
          <div className="flex gap-2">
            <Input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Scenario name..."
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <Button size="sm" onClick={handleCreate} disabled={isCreating}>
              <Plus className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowCreate(false);
                setNewName('');
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Scenario
            </Button>
            
            {/* Import/Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <FileCode className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportProject} disabled={isExporting || scenarios.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Export All to YAML
                </DropdownMenuItem>
                <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                  <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Upload className="w-4 h-4 mr-2" />
                      Import from YAML
                    </DropdownMenuItem>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>Import Scenarios from YAML</DialogTitle>
                      <DialogDescription>
                        Paste or upload a YAML file containing test scenarios
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 h-[calc(80vh-120px)]">
                      <YamlEditor
                        value={importYamlContent}
                        onChange={setImportYamlContent}
                        onImport={handleImportProject}
                        mode="project"
                        height="100%"
                        showPreview={true}
                        showActions={true}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Scenario List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-6 text-center text-slate-500">Loading...</div>
        ) : filteredScenarios.length === 0 ? (
          <div className="p-6">
            <Card className="border-dashed">
              <CardHeader className="text-center">
                <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                  <FlaskConical className="w-5 h-5 text-slate-400" />
                </div>
                <CardTitle className="text-base">No Scenarios</CardTitle>
                <CardDescription>
                  {searchQuery
                    ? 'No scenarios match your search'
                    : 'Create your first test scenario'}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredScenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => onSelectScenario(scenario)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-all',
                  selectedScenario?.id === scenario.id
                    ? 'bg-violet-50 border-violet-200 ring-2 ring-violet-500 ring-offset-1'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {scenario.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] px-1.5', PRIORITY_COLORS[scenario.priority])}
                      >
                        {scenario.priority}
                      </Badge>
                    </div>
                    {scenario.description && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {scenario.description}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">
                      Updated {new Date(scenario.updatedAt * 1000).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleDelete(e, scenario.id)}
                      disabled={isDeleting}
                      className="p-1 hover:bg-slate-200 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

