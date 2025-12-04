import { useState } from 'react';
import {
  Plus,
  Trash2,
  ChevronRight,
  FlaskConical,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useTestScenarios } from '@/hooks/useTestScenarios';
import { TestScenario, PRIORITY_COLORS } from '@/types/scenario';
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

  const {
    scenarios,
    isLoading,
    createScenario,
    deleteScenario,
    isCreating,
    isDeleting,
  } = useTestScenarios(projectId);

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
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Scenario
          </Button>
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

