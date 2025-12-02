import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: number;
  statusText?: string;
  className?: string;
}

export function StatusBadge({ status, statusText, className }: StatusBadgeProps) {
  const getVariant = () => {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'default';
    if (status >= 400 && status < 500) return 'warning';
    if (status >= 500) return 'destructive';
    return 'secondary';
  };

  return (
    <Badge variant={getVariant()} className={cn('font-mono', className)}>
      {status} {statusText}
    </Badge>
  );
}

