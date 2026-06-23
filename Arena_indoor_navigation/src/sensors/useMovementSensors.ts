import { useEffect, useRef, useState } from 'react';

import type { RawSensorSample } from '../mapEngine/shared';
import {
  createExpoMovementSensorAdapter,
  type ExpoMovementSensorDiagnosticState,
} from './expoMovementSensorAdapter';
import {
  MovementSensorCollector,
  type MovementSensorCollectorDiagnostic,
} from './movementSensorCollector';
import {
  deriveMovementSensorStatus,
  type MovementSensorStatus,
} from './movementSensorStatus';
export { MovementSensorDevPanel } from './debugger/MovementSensorDevPanel';
import { MockMovementSensorAdapter } from './mock/mockMovementSensorAdapter';
import {
  getMockMovementSensorScenarios,
} from './mock/scenarios';
import type {
  MockMovementSensorPlaybackState,
  MockMovementSensorScenarioId,
  MockMovementSensorState,
} from './mock/mockSensorTypes';
import { findLatestPedometerStepCount } from './pedometerUtils';
import type { PedometerDiagnosticState } from './realPedometerMonitor';

export const EMPTY_SENSOR_SAMPLES: readonly RawSensorSample[] = Object.freeze([]);

export type MovementSensorMode = 'real' | 'mock';

export type MovementSensorDevControls = {
  enabled: boolean;
  mode: MovementSensorMode;
  setMode(mode: MovementSensorMode): void;
  realPedometer: {
    diagnostic: PedometerDiagnosticState;
    retry(): Promise<void>;
  };
  realSensors: {
    collector: MovementSensorCollectorDiagnostic;
    adapter: ExpoMovementSensorDiagnosticState;
  };
  scenarios: ReturnType<typeof getMockMovementSensorScenarios>;
  scenarioId: MockMovementSensorScenarioId;
  setScenario(scenarioId: MockMovementSensorScenarioId): void;
  playbackState: MockMovementSensorPlaybackState;
  currentBatchIndex: number;
  totalBatches: number;
  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  advanceOneBatch(): void;
};

export type UseMovementSensorsResult = {
  samples: readonly RawSensorSample[];
  latestKnownPedometerSteps: number | null;
  resetSignal: number;
  status: MovementSensorStatus;
  developmentControls: MovementSensorDevControls;
};

const isDevelopmentBuild =
  typeof __DEV__ !== 'undefined'
    ? __DEV__
    : process.env.NODE_ENV !== 'production';

const availableMockScenarios = getMockMovementSensorScenarios();
const INITIAL_COLLECTOR_DIAGNOSTIC: MovementSensorCollectorDiagnostic = {
  status: 'idle',
  startedAt: null,
  subscribedAt: null,
  firstSampleAt: null,
  firstBatchAt: null,
};

export function useMovementSensors(enabled = true): UseMovementSensorsResult {
  const [sensorSamples, setSensorSamples] =
    useState<readonly RawSensorSample[]>(EMPTY_SENSOR_SAMPLES);
  const [latestKnownPedometerSteps, setLatestKnownPedometerSteps] =
    useState<number | null>(null);
  const [mode, setModeState] = useState<MovementSensorMode>('real');
  const [scenarioId, setScenarioId] =
    useState<MockMovementSensorScenarioId>('straight-walk');
  const [resetSignal, setResetSignal] = useState(0);
  const [mockState, setMockState] = useState<MockMovementSensorState>({
    scenarioId: 'straight-walk',
    playbackState: 'stopped',
    currentBatchIndex: 0,
    totalBatches: getMockMovementSensorScenarios().find((scenario) => scenario.id === 'straight-walk')?.batches.length ?? 0,
    currentPedometerSteps: 0,
  });
  const [mockAdapter] = useState(
    () => new MockMovementSensorAdapter({ scenarioId: 'straight-walk' }),
  );
  const [realAdapter] = useState(() => createExpoMovementSensorAdapter());
  const [realPedometerDiagnostic, setRealPedometerDiagnostic] =
    useState<PedometerDiagnosticState>(realAdapter.realPedometerMonitor.getState());
  const [collectorDiagnostic, setCollectorDiagnostic] =
    useState<MovementSensorCollectorDiagnostic>(INITIAL_COLLECTOR_DIAGNOSTIC);
  const [realAdapterDiagnostic, setRealAdapterDiagnostic] =
    useState<ExpoMovementSensorDiagnosticState>(realAdapter.getDiagnosticState());
  const activeCollectorRef = useRef<MovementSensorCollector | null>(null);

  useEffect(() => mockAdapter.subscribeState(setMockState), [mockAdapter]);
  useEffect(
    () => realAdapter.realPedometerMonitor.subscribeState((state) => {
      setRealPedometerDiagnostic(state);
      if (state.rawCumulativeSteps !== null) {
        setLatestKnownPedometerSteps(state.rawCumulativeSteps);
      }
    }),
    [realAdapter],
  );
  useEffect(
    () => realAdapter.subscribeDiagnosticState(setRealAdapterDiagnostic),
    [realAdapter],
  );

  useEffect(() => {
    if (!enabled) {
      setSensorSamples(EMPTY_SENSOR_SAMPLES);
      setLatestKnownPedometerSteps(null);
      activeCollectorRef.current?.stop();
      activeCollectorRef.current = null;
      return undefined;
    }

    const selectedAdapter =
      isDevelopmentBuild && mode === 'mock'
        ? mockAdapter
        : realAdapter;
    const collector = new MovementSensorCollector(
      selectedAdapter,
      (batch) => {
        setSensorSamples(batch);
        const latestSteps = findLatestPedometerStepCount(batch);
        if (latestSteps !== null) {
          setLatestKnownPedometerSteps(latestSteps);
        }
      },
      {
        capacity: 128,
        batchIntervalMs: 250,
        onDiagnostic: setCollectorDiagnostic,
        flushFirstSampleImmediately: selectedAdapter === realAdapter,
      },
    );
    activeCollectorRef.current = collector;
    setSensorSamples(EMPTY_SENSOR_SAMPLES);
    void collector.start();

    return () => {
      collector.stop();
      if (activeCollectorRef.current === collector) {
        activeCollectorRef.current = null;
      }
      if (selectedAdapter === mockAdapter) {
        mockAdapter.stop();
      }
    };
  }, [enabled, mockAdapter, mode, realAdapter]);

  function bumpResetSignal() {
    setResetSignal((currentSignal) => currentSignal + 1);
  }

  function syncLatestKnownFromMockState(nextState: MockMovementSensorState = mockAdapter.getState()) {
    setLatestKnownPedometerSteps(nextState.currentPedometerSteps);
    setSensorSamples(EMPTY_SENSOR_SAMPLES);
  }

  function setMode(modeValue: MovementSensorMode) {
    if (!isDevelopmentBuild) {
      return;
    }

    if (modeValue === 'real') {
      mockAdapter.stop();
      setLatestKnownPedometerSteps(null);
    } else {
      mockAdapter.reset();
      syncLatestKnownFromMockState(mockAdapter.getState());
    }
    setSensorSamples(EMPTY_SENSOR_SAMPLES);
    setModeState(modeValue);
    bumpResetSignal();
  }

  function setScenario(nextScenarioId: MockMovementSensorScenarioId) {
    if (!isDevelopmentBuild) {
      return;
    }

    mockAdapter.setScenario(nextScenarioId);
    setScenarioId(nextScenarioId);
    syncLatestKnownFromMockState(mockAdapter.getState());
    bumpResetSignal();
  }

  function startMock() {
    mockAdapter.start();
  }

  function pauseMock() {
    mockAdapter.pause();
  }

  function resumeMock() {
    mockAdapter.resume();
  }

  function resetMock() {
    mockAdapter.reset();
    syncLatestKnownFromMockState(mockAdapter.getState());
    bumpResetSignal();
  }

  function advanceMockOneBatch() {
    mockAdapter.advanceOneBatch();
    activeCollectorRef.current?.flush();
  }

  async function retryRealPedometer() {
    await realAdapter.retryPedometerSubscription();
  }

  const status = deriveMovementSensorStatus(
    mode,
    collectorDiagnostic,
    realAdapterDiagnostic,
  );

  return {
    samples: sensorSamples,
    latestKnownPedometerSteps,
    resetSignal,
    status,
    developmentControls: {
      enabled: isDevelopmentBuild,
      mode,
      setMode,
      realPedometer: {
        diagnostic: realPedometerDiagnostic,
        retry: retryRealPedometer,
      },
      realSensors: {
        collector: collectorDiagnostic,
        adapter: realAdapterDiagnostic,
      },
      scenarios: availableMockScenarios,
      scenarioId,
      setScenario,
      playbackState: mockState.playbackState,
      currentBatchIndex: mockState.currentBatchIndex,
      totalBatches: mockState.totalBatches,
      start: startMock,
      pause: pauseMock,
      resume: resumeMock,
      reset: resetMock,
      advanceOneBatch: advanceMockOneBatch,
    },
  };
}
