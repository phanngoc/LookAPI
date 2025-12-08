import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useCallback } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { tauriService } from '@/services/tauri';
import {
  PerformanceTestConfig,
  PerformanceTestRun,
  CreatePerformanceTestInput,
  Stage,
  Threshold,
  PerfStartedEvent,
  PerfProgressEvent,
  PerfStageChangedEvent,
  PerfCompletedEvent,
  PerfRequestCompletedEvent,
} from '@/types/performance';

// ============================================================================
// Performance Test Configuration Hooks
// ============================================================================

/**
 * Hook for managing performance test configurations for a scenario
 */
export function usePerformanceTests(scenarioId: string) {
  const queryClient = useQueryClient();

  const {
    data: configs,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['performanceTests', scenarioId],
    queryFn: () => tauriService.getPerformanceTests(scenarioId),
    enabled: !!scenarioId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreatePerformanceTestInput) =>
      tauriService.createPerformanceTest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performanceTests', scenarioId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (configId: string) => tauriService.deletePerformanceTest(configId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performanceTests', scenarioId] });
    },
  });

  return {
    configs: configs || [],
    isLoading,
    error,
    refetch,
    createConfig: createMutation.mutateAsync,
    deleteConfig: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

/**
 * Hook for a single performance test configuration
 */
export function usePerformanceTest(configId: string) {
  const queryClient = useQueryClient();

  const {
    data: config,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['performanceTest', configId],
    queryFn: () => tauriService.getPerformanceTest(configId),
    enabled: !!configId,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      name,
      testType,
      vus,
      durationSecs,
      iterations,
      stages,
      thresholds,
    }: {
      name?: string;
      testType?: string;
      vus?: number;
      durationSecs?: number;
      iterations?: number;
      stages?: Stage[];
      thresholds?: Threshold[];
    }) =>
      tauriService.updatePerformanceTest(
        configId,
        name,
        testType,
        vus,
        durationSecs,
        iterations,
        stages,
        thresholds
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(['performanceTest', configId], updated);
      queryClient.invalidateQueries({ queryKey: ['performanceTests'] });
    },
  });

  return {
    config,
    isLoading,
    error,
    refetch,
    updateConfig: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

// ============================================================================
// Performance Test Run Hooks
// ============================================================================

/**
 * Hook for performance test runs
 */
export function usePerformanceTestRuns(configId: string) {
  const queryClient = useQueryClient();

  const {
    data: runs,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['performanceTestRuns', configId],
    queryFn: () => tauriService.getPerformanceTestRuns(configId),
    enabled: !!configId,
  });

  const runMutation = useMutation({
    mutationFn: () => tauriService.runPerformanceTest(configId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performanceTestRuns', configId] });
    },
  });

  return {
    runs: runs || [],
    isLoading,
    error,
    refetch,
    runTest: runMutation.mutateAsync,
    isRunning: runMutation.isPending,
    lastRun: runs?.[0] || null,
  };
}

// ============================================================================
// Real-time Performance Test Progress Hook
// ============================================================================

export interface PerformanceProgress {
  runId: string | null;
  isRunning: boolean;
  elapsedSecs: number;
  currentVus: number;
  totalRequests: number;
  failedRequests: number;
  rps: number;
  errorRate: number;
  p95Duration: number;
  iterationsCompleted: number;
  currentStage: {
    index: number;
    targetVus: number;
    durationSecs: number;
  } | null;
  recentRequests: PerfRequestCompletedEvent[];
}

/**
 * Hook for real-time performance test progress
 */
export function usePerformanceProgress() {
  const [progress, setProgress] = useState<PerformanceProgress>({
    runId: null,
    isRunning: false,
    elapsedSecs: 0,
    currentVus: 0,
    totalRequests: 0,
    failedRequests: 0,
    rps: 0,
    errorRate: 0,
    p95Duration: 0,
    iterationsCompleted: 0,
    currentStage: null,
    recentRequests: [],
  });

  const [completedRun, setCompletedRun] = useState<PerformanceTestRun | null>(null);

  const resetProgress = useCallback(() => {
    setProgress({
      runId: null,
      isRunning: false,
      elapsedSecs: 0,
      currentVus: 0,
      totalRequests: 0,
      failedRequests: 0,
      rps: 0,
      errorRate: 0,
      p95Duration: 0,
      iterationsCompleted: 0,
      currentStage: null,
      recentRequests: [],
    });
    setCompletedRun(null);
  }, []);

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const setupListeners = async () => {
      // Listen for test started
      unlisteners.push(
        await listen<PerfStartedEvent>('perf-started', (event) => {
          setProgress((prev) => ({
            ...prev,
            runId: event.payload.runId,
            isRunning: true,
          }));
          setCompletedRun(null);
        })
      );

      // Listen for progress updates
      unlisteners.push(
        await listen<PerfProgressEvent>('perf-progress', (event) => {
          setProgress((prev) => ({
            ...prev,
            runId: event.payload.runId,
            elapsedSecs: event.payload.elapsedSecs,
            currentVus: event.payload.currentVus,
            totalRequests: event.payload.totalRequests,
            failedRequests: event.payload.failedRequests,
            rps: event.payload.rps,
            errorRate: event.payload.errorRate,
            p95Duration: event.payload.p95Duration,
            iterationsCompleted: event.payload.iterationsCompleted,
          }));
        })
      );

      // Listen for stage changes
      unlisteners.push(
        await listen<PerfStageChangedEvent>('perf-stage-changed', (event) => {
          setProgress((prev) => ({
            ...prev,
            currentStage: {
              index: event.payload.stageIndex,
              targetVus: event.payload.targetVus,
              durationSecs: event.payload.durationSecs,
            },
          }));
        })
      );

      // Listen for individual request completions
      unlisteners.push(
        await listen<PerfRequestCompletedEvent>('perf-request-completed', (event) => {
          setProgress((prev) => ({
            ...prev,
            recentRequests: [...prev.recentRequests.slice(-99), event.payload],
          }));
        })
      );

      // Listen for test completed
      unlisteners.push(
        await listen<PerfCompletedEvent>('perf-completed', (event) => {
          setProgress((prev) => ({
            ...prev,
            isRunning: false,
          }));
          setCompletedRun(event.payload.run);
        })
      );
    };

    setupListeners();

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  return {
    progress,
    completedRun,
    resetProgress,
  };
}

// ============================================================================
// Combined Hook for Full Performance Testing Workflow
// ============================================================================

/**
 * Combined hook for performance testing a scenario
 */
export function useScenarioPerformanceTest(scenarioId: string) {
  const queryClient = useQueryClient();
  const { progress, completedRun, resetProgress } = usePerformanceProgress();

  // Get all configs for this scenario
  const {
    data: configs,
    isLoading: isLoadingConfigs,
    refetch: refetchConfigs,
  } = useQuery({
    queryKey: ['performanceTests', scenarioId],
    queryFn: () => tauriService.getPerformanceTests(scenarioId),
    enabled: !!scenarioId,
  });

  // Create config mutation
  const createConfigMutation = useMutation({
    mutationFn: (input: CreatePerformanceTestInput) =>
      tauriService.createPerformanceTest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performanceTests', scenarioId] });
    },
  });

  // Delete config mutation
  const deleteConfigMutation = useMutation({
    mutationFn: (configId: string) => tauriService.deletePerformanceTest(configId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performanceTests', scenarioId] });
    },
  });

  // Run test mutation
  const runTestMutation = useMutation({
    mutationFn: (configId: string) => tauriService.runPerformanceTest(configId),
    onMutate: () => {
      resetProgress();
    },
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ['performanceTestRuns'] });
    },
  });

  // Get runs for a specific config
  const getRunsForConfig = useCallback(
    async (configId: string) => {
      return tauriService.getPerformanceTestRuns(configId);
    },
    []
  );

  return {
    // Configs
    configs: configs || [],
    isLoadingConfigs,
    refetchConfigs,
    createConfig: createConfigMutation.mutateAsync,
    deleteConfig: deleteConfigMutation.mutateAsync,
    isCreating: createConfigMutation.isPending,
    isDeleting: deleteConfigMutation.isPending,

    // Running tests
    runTest: runTestMutation.mutateAsync,
    isRunning: runTestMutation.isPending || progress.isRunning,

    // Progress
    progress,
    completedRun,
    resetProgress,

    // Runs
    getRunsForConfig,
  };
}
