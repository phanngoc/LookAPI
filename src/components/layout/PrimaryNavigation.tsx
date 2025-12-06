import { Code2, FlaskConical, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type FeatureType = 'api' | 'scenario' | 'database';

interface PrimaryNavigationProps {
  activeFeature: FeatureType | null;
  onSelectFeature: (feature: FeatureType) => void;
}

const features: Array<{
  id: FeatureType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'api',
    label: 'API Testing',
    icon: Code2,
  },
  {
    id: 'scenario',
    label: 'Scenario Testing',
    icon: FlaskConical,
  },
  {
    id: 'database',
    label: 'Database Query',
    icon: Database,
  },
];

export function PrimaryNavigation({
  activeFeature,
  onSelectFeature,
}: PrimaryNavigationProps) {
  return (
    <div className="w-16 border-r border-slate-200 bg-white flex flex-col items-center py-4 shrink-0">
      <TooltipProvider>
        {features.map((feature) => {
          const Icon = feature.icon;
          const isActive = activeFeature === feature.id;

          return (
            <Tooltip key={feature.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onSelectFeature(feature.id)}
                  className={cn(
                    'w-12 h-12 rounded-lg flex items-center justify-center transition-all mb-2',
                    isActive
                      ? 'bg-blue-50 text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  )}
                >
                  <Icon className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{feature.label}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </div>
  );
}
