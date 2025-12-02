import { Badge } from '@/components/ui/badge';

interface MethodBadgeProps {
  method: string;
  className?: string;
}

export function MethodBadge({ method, className }: MethodBadgeProps) {
  const getVariant = () => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'get';
      case 'POST':
        return 'post';
      case 'PUT':
        return 'put';
      case 'DELETE':
        return 'delete';
      case 'PATCH':
        return 'patch';
      default:
        return 'secondary';
    }
  };

  return (
    <Badge variant={getVariant()} className={className}>
      {method.toUpperCase()}
    </Badge>
  );
}

