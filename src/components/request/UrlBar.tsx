import React from 'react';
import { Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface UrlBarProps {
  method: string;
  url: string;
  onMethodChange: (method: string) => void;
  onUrlChange: (url: string) => void;
  onExecute: () => void;
  isExecuting: boolean;
  disabled?: boolean;
}

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const getMethodColor = (method: string) => {
  switch (method) {
    case 'GET':
      return 'text-emerald-600 border-emerald-200 bg-emerald-50';
    case 'POST':
      return 'text-violet-600 border-violet-200 bg-violet-50';
    case 'PUT':
      return 'text-amber-600 border-amber-200 bg-amber-50';
    case 'PATCH':
      return 'text-orange-600 border-orange-200 bg-orange-50';
    case 'DELETE':
      return 'text-red-600 border-red-200 bg-red-50';
    default:
      return 'text-slate-600 border-slate-200 bg-slate-50';
  }
};

export function UrlBar({
  method,
  url,
  onMethodChange,
  onUrlChange,
  onExecute,
  isExecuting,
  disabled,
}: UrlBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      onExecute();
    }
  };

  return (
    <div className="flex items-center gap-2 p-4 bg-white border-b border-slate-200">
      {/* Method Selector */}
      <Select value={method} onValueChange={onMethodChange}>
        <SelectTrigger
          className={cn(
            'w-[110px] h-10 font-semibold text-sm',
            getMethodColor(method)
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {methods.map((m) => (
            <SelectItem key={m} value={m} className="font-medium">
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* URL Input */}
      <div className="flex-1 relative">
        <Input
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter request URL or paste cURL"
          className="h-10 pr-24 font-mono text-sm bg-slate-50"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-sans">
            ⌘ Enter
          </kbd>
        </div>
      </div>

      {/* Send Button */}
      <Button
        onClick={onExecute}
        disabled={isExecuting || disabled}
        className="h-10 px-6 gap-2 font-semibold"
      >
        {isExecuting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Sending...</span>
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            <span>Send</span>
          </>
        )}
      </Button>
    </div>
  );
}

