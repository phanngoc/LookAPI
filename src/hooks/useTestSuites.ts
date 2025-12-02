import { useQuery } from '@tanstack/react-query';
import { tauriService } from '../services/tauri';

export function useTestSuites() {
  const { data: testSuites, isLoading, error } = useQuery({
    queryKey: ['testSuites'],
    queryFn: () => tauriService.getAllTestSuites(),
  });

  return { testSuites: testSuites || [], isLoading, error };
}
