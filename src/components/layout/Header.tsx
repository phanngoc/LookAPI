import { Zap, Settings, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import { ProjectSelector } from '@/components/project/ProjectSelector';

export function Header() {
  const { environments, activeEnvironment, setActiveEnvironment } = useEnvironment();

  const handleEnvironmentChange = (envId: string) => {
    const env = environments.find((e) => e.id === envId);
    setActiveEnvironment(env || null);
  };

  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 shrink-0">
      {/* Logo & Title */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">API Tester</h1>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200" />

        {/* Project Selector */}
        <ProjectSelector />
      </div>

      {/* Environment Selector */}
      <div className="flex items-center gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-500" />
                <Select
                  value={activeEnvironment?.id || ''}
                  onValueChange={handleEnvironmentChange}
                >
                  <SelectTrigger className="w-[180px] h-8 text-sm">
                    <SelectValue placeholder="Select environment">
                      {activeEnvironment && (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: activeEnvironment.color }}
                          />
                          <span>{activeEnvironment.name}</span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {environments.map((env) => (
                      <SelectItem key={env.id} value={env.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: env.color }}
                          />
                          <span>{env.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Select environment for API requests</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="h-6 w-px bg-slate-200" />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
}

