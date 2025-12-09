import { Plus, Trash2, ChevronRight, Zap, Activity, TrendingUp, Gauge, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { PerformanceTestConfig, PerformanceTestType, getTestTypeDescription } from '@/types/performance';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface Props {
  configs: PerformanceTestConfig[];
  selectedConfig: PerformanceTestConfig | null;
  onSelect: (config: PerformanceTestConfig) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
  isCreating?: boolean;
  isDeleting?: boolean;
}

const TEST_TYPE_ICONS: Record<PerformanceTestType, React.ReactNode> = {
  smoke: <Zap className="w-4 h-4" />,
  load: <Activity className="w-4 h-4" />,
  stress: <TrendingUp className="w-4 h-4" />,
  spike: <Gauge className="w-4 h-4" />,
  soak: <Timer className="w-4 h-4" />,
};

const TEST_TYPE_COLORS: Record<PerformanceTestType, string> = {
  smoke: 'bg-slate-100 text-slate-600',
  load: 'bg-blue-100 text-blue-600',
  stress: 'bg-orange-100 text-orange-600',
  spike: 'bg-purple-100 text-purple-600',
  soak: 'bg-teal-100 text-teal-600',
};

export function ConfigList({
  configs,
  selectedConfig,
  onSelect,
  onCreate,
  onDelete,
  isCreating,
  isDeleting,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName('');
    setShowCreate(false);
  };

  const getConfigSummary = (config: PerformanceTestConfig): string => {
    if (config.stages && config.stages.length > 0) {
      const maxVus = Math.max(...config.stages.map((s) => s.targetVus));
      const totalDuration = config.stages.reduce((sum, s) => sum + s.durationSecs, 0);
      const mins = Math.floor(totalDuration / 60);
      return `${maxVus} VUs, ${mins}min`;
    }
    if (config.vus) {
      const mins = config.durationSecs ? Math.floor(config.durationSecs / 60) : 0;
      return `${config.vus} VUs, ${mins}min`;
    }
    return getTestTypeDescription(config.testType);
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200">
      {/* Create Button */}
      <div className="p-3 border-b border-slate-200">
        {showCreate ? (
          <div className="flex gap-2">
            <Input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Test name..."
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
              disabled={isCreating}
            />
            <Button size="sm" onClick={handleCreate} disabled={isCreating || !newName.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowCreate(false);
                setNewName('');
              }}
              disabled={isCreating}
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
            New Performance Test
          </Button>
        )}
      </div>

      {/* Configs List */}
      <ScrollArea className="flex-1">
        {configs.length === 0 ? (
          <div className="p-6">
            <Card className="border-dashed">
              <CardHeader className="text-center">
                <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                  <Activity className="w-5 h-5 text-slate-400" />
                </div>
                <CardTitle className="text-base">No Performance Tests</CardTitle>
                <CardDescription>
                  Create your first performance test configuration
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {configs.map((config) => (
              <button
                key={config.id}
                onClick={() => onSelect(config)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-all',
                  selectedConfig?.id === config.id
                    ? 'bg-orange-50 border-orange-200 ring-2 ring-orange-500 ring-offset-1'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className={cn(
                        'flex items-center justify-center w-8 h-8 rounded-lg',
                        TEST_TYPE_COLORS[config.testType]
                      )}
                    >
                      {TEST_TYPE_ICONS[config.testType]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {config.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {config.testType}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {getConfigSummary(config)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(config.id);
                      }}
                      className="p-1 hover:bg-slate-200 rounded transition-colors"
                      disabled={isDeleting}
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
