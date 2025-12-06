import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tauriService } from '@/services/tauri';
import {
  CreateStepRequest,
  UpdateStepRequest,
  UpdateScenarioRequest,
} from '@/types/scenario';

// Hook for fetching scenarios by project
export function useTestScenarios(projectId: string) {
  const queryClient = useQueryClient();

  const {
    data: scenarios,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['testScenarios', projectId],
    queryFn: () => tauriService.getTestScenarios(projectId),
    enabled: !!projectId,
  });

  const createScenarioMutation = useMutation({
    mutationFn: ({
      name,
      description,
      priority,
    }: {
      name: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high';
    }) => tauriService.createTestScenario(projectId, name, description, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testScenarios', projectId] });
    },
  });

  const updateScenarioMutation = useMutation({
    mutationFn: (request: UpdateScenarioRequest) => tauriService.updateTestScenario(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testScenarios', projectId] });
    },
  });

  const deleteScenarioMutation = useMutation({
    mutationFn: (scenarioId: string) => tauriService.deleteTestScenario(scenarioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testScenarios', projectId] });
    },
  });

  return {
    scenarios: scenarios || [],
    isLoading,
    error,
    refetch,
    createScenario: createScenarioMutation.mutateAsync,
    updateScenario: updateScenarioMutation.mutateAsync,
    deleteScenario: deleteScenarioMutation.mutateAsync,
    isCreating: createScenarioMutation.isPending,
    isUpdating: updateScenarioMutation.isPending,
    isDeleting: deleteScenarioMutation.isPending,
  };
}

// Hook for fetching a single scenario
export function useTestScenario(scenarioId: string) {
  const queryClient = useQueryClient();

  const {
    data: scenario,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['testScenario', scenarioId],
    queryFn: () => tauriService.getTestScenario(scenarioId),
    enabled: !!scenarioId,
  });

  const updateMutation = useMutation({
    mutationFn: (request: UpdateScenarioRequest) => tauriService.updateTestScenario(request),
    onSuccess: (updated) => {
      queryClient.setQueryData(['testScenario', scenarioId], updated);
      queryClient.invalidateQueries({ queryKey: ['testScenarios'] });
    },
  });

  return {
    scenario,
    isLoading,
    error,
    refetch,
    updateScenario: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

// Hook for fetching scenario steps
export function useTestScenarioSteps(scenarioId: string) {
  const queryClient = useQueryClient();

  const {
    data: steps,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['testScenarioSteps', scenarioId],
    queryFn: () => tauriService.getTestScenarioSteps(scenarioId),
    enabled: !!scenarioId,
  });

  const addStepMutation = useMutation({
    mutationFn: (request: CreateStepRequest) => tauriService.addTestScenarioStep(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testScenarioSteps', scenarioId] });
    },
  });

  const updateStepMutation = useMutation({
    mutationFn: (request: UpdateStepRequest) => tauriService.updateTestScenarioStep(request),
    onSuccess: (updatedStep) => {
      // Optimistically update the cache with the returned step
      queryClient.setQueryData<typeof steps>(
        ['testScenarioSteps', scenarioId],
        (oldSteps) => oldSteps?.map((s) => (s.id === updatedStep.id ? updatedStep : s)) ?? []
      );
      // Still invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['testScenarioSteps', scenarioId] });
    },
  });

  const deleteStepMutation = useMutation({
    mutationFn: (stepId: string) => tauriService.deleteTestScenarioStep(stepId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testScenarioSteps', scenarioId] });
    },
  });

  const reorderStepsMutation = useMutation({
    mutationFn: (stepIds: string[]) =>
      tauriService.reorderTestScenarioSteps({ scenarioId, stepIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testScenarioSteps', scenarioId] });
    },
  });

  return {
    steps: steps || [],
    isLoading,
    error,
    refetch,
    addStep: addStepMutation.mutateAsync,
    updateStep: updateStepMutation.mutateAsync,
    deleteStep: deleteStepMutation.mutateAsync,
    reorderSteps: reorderStepsMutation.mutateAsync,
    isAdding: addStepMutation.isPending,
    isUpdating: updateStepMutation.isPending,
    isDeleting: deleteStepMutation.isPending,
    isReordering: reorderStepsMutation.isPending,
  };
}

// Hook for running scenarios and fetching runs
export function useTestScenarioRuns(scenarioId: string) {
  const queryClient = useQueryClient();

  const {
    data: runs,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['testScenarioRuns', scenarioId],
    queryFn: () => tauriService.getTestScenarioRuns(scenarioId),
    enabled: !!scenarioId,
  });

  const runScenarioMutation = useMutation({
    mutationFn: () => tauriService.runTestScenario(scenarioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testScenarioRuns', scenarioId] });
    },
  });

  return {
    runs: runs || [],
    isLoading,
    error,
    refetch,
    runScenario: runScenarioMutation.mutateAsync,
    isRunning: runScenarioMutation.isPending,
    lastRun: runs?.[0] || null,
  };
}

