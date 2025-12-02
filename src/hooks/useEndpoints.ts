import { useQuery } from '@tanstack/react-query';
import { tauriService } from '../services/tauri';

export function useEndpoints() {
  const { data: endpoints, isLoading, error, refetch } = useQuery({
    queryKey: ['endpoints'],
    queryFn: () => tauriService.getAllEndpoints(),
  });

  return { endpoints: endpoints || [], isLoading, error, refetch };
}
