import { useState, useEffect, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  ScenarioStartedEvent,
  StepStartedEvent,
  StepCompletedEvent,
  ScenarioCompletedEvent,
  TestStepResult,
  TestScenarioRun,
} from '@/types/scenario';

interface ProgressState {
  runId: string | null;
  scenarioId: string | null;
  totalSteps: number;
  currentStepIndex: number;
  progressPercentage: number;
  stepResults: Map<string, TestStepResult>;
  startedAt: number | null;
  elapsedTime: number; // in milliseconds
  isRunning: boolean;
  finalRun: TestScenarioRun | null;
}

export function useTestScenarioProgress(scenarioId: string | null) {
  const [progress, setProgress] = useState<ProgressState>({
    runId: null,
    scenarioId: null,
    totalSteps: 0,
    currentStepIndex: -1,
    progressPercentage: 0,
    stepResults: new Map(),
    startedAt: null,
    elapsedTime: 0,
    isRunning: false,
    finalRun: null,
  });

  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!scenarioId) {
      return;
    }

    let mounted = true;

    const setupListeners = async () => {
      // Listen for scenario started
      const unlistenStarted = await listen<ScenarioStartedEvent>(
        'scenario-started',
        (event) => {
          if (!mounted || event.payload.scenarioId !== scenarioId) return;

          currentRunIdRef.current = event.payload.runId;

          setProgress((prev) => ({
            ...prev,
            runId: event.payload.runId,
            scenarioId: event.payload.scenarioId,
            totalSteps: event.payload.totalSteps,
            currentStepIndex: -1,
            progressPercentage: 0,
            stepResults: new Map(),
            startedAt: event.payload.startedAt,
            elapsedTime: 0,
            isRunning: true,
            finalRun: null,
          }));

          // Start elapsed time counter
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          intervalRef.current = setInterval(() => {
            setProgress((prev) => {
              if (!prev.startedAt || !prev.isRunning) return prev;
              const elapsed = Date.now() - prev.startedAt * 1000;
              return { ...prev, elapsedTime: elapsed };
            });
          }, 100);
        }
      );

      // Listen for step started
      const unlistenStepStarted = await listen<StepStartedEvent>(
        'step-started',
        (event) => {
          if (!mounted || event.payload.runId !== currentRunIdRef.current) return;

          setProgress((prev) => {
            // Only update if this is for the current run
            if (prev.runId === event.payload.runId) {
              return {
                ...prev,
                currentStepIndex: event.payload.stepIndex,
              };
            }
            return prev;
          });
        }
      );

      // Listen for step completed
      const unlistenStepCompleted = await listen<StepCompletedEvent>(
        'step-completed',
        (event) => {
          if (!mounted || event.payload.runId !== currentRunIdRef.current) return;

          setProgress((prev) => {
            // Only update if this is for the current run
            if (prev.runId === event.payload.runId) {
              const newStepResults = new Map(prev.stepResults);
              newStepResults.set(event.payload.stepId, event.payload.result);

              return {
                ...prev,
                stepResults: newStepResults,
                progressPercentage: event.payload.progressPercentage,
              };
            }
            return prev;
          });
        }
      );

      // Listen for scenario completed
      const unlistenCompleted = await listen<ScenarioCompletedEvent>(
        'scenario-completed',
        (event) => {
          if (!mounted || event.payload.runId !== currentRunIdRef.current) return;

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          setProgress((prev) => {
            // Only update if this is for the current run
            if (prev.runId === event.payload.runId) {
              return {
                ...prev,
                isRunning: false,
                finalRun: event.payload.run,
                progressPercentage: 100,
              };
            }
            return prev;
          });
        }
      );

      unlistenRefs.current = [
        unlistenStarted,
        unlistenStepStarted,
        unlistenStepCompleted,
        unlistenCompleted,
      ];
    };

    setupListeners();

    return () => {
      mounted = false;
      unlistenRefs.current.forEach((unlisten) => unlisten());
      unlistenRefs.current = [];
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      currentRunIdRef.current = null;
    };
  }, [scenarioId]);

  const reset = () => {
    currentRunIdRef.current = null;
    setProgress({
      runId: null,
      scenarioId: null,
      totalSteps: 0,
      currentStepIndex: -1,
      progressPercentage: 0,
      stepResults: new Map(),
      startedAt: null,
      elapsedTime: 0,
      isRunning: false,
      finalRun: null,
    });
  };

  return {
    progress,
    reset,
  };
}
