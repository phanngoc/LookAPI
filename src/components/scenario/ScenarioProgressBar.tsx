import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScenarioProgressBarProps {
  progressPercentage: number;
  currentStepIndex: number;
  totalSteps: number;
  elapsedTime: number; // in milliseconds
  isRunning: boolean;
}

export function ScenarioProgressBar({
  progressPercentage,
  currentStepIndex,
  totalSteps,
  elapsedTime,
  isRunning,
}: ScenarioProgressBarProps) {
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  const currentStep = currentStepIndex >= 0 ? currentStepIndex + 1 : 0;
  const displayPercentage = Math.min(100, Math.max(0, progressPercentage));

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            isRunning
              ? 'bg-blue-500'
              : progressPercentage >= 100
              ? 'bg-emerald-500'
              : 'bg-slate-300'
          )}
          style={{ width: `${displayPercentage}%` }}
        >
          {isRunning && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          )}
        </div>
      </div>

      {/* Progress info */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">
              {totalSteps > 0 ? (
                <>
                  Step {currentStep} of {totalSteps}
                </>
              ) : (
                'Ready'
              )}
            </span>
            <span className="text-slate-500">
              ({displayPercentage.toFixed(0)}%)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatTime(elapsedTime)}</span>
        </div>
      </div>
    </div>
  );
}
