import { useQuery } from '@tanstack/react-query';
import { tauriService } from '../services/tauri';

export function useEndpoints(projectId?: string) {
  const { data: endpoints, isLoading, error, refetch } = useQuery({
    queryKey: ['endpoints', projectId],
    queryFn: () => {
      if (projectId) {
        return tauriService.getEndpointsByProject(projectId);
      }
      return Promise.resolve([]);
    },
    enabled: !!projectId,
  });

  return { endpoints: endpoints || [], isLoading, error, refetch };
}
