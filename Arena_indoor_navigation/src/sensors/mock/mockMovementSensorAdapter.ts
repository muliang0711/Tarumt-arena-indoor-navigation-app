import type { RawSensorSample } from '../../mapEngine/shared';
import type {
  MovementSensorAdapter,
  SensorSubscription,
} from '../movementSensorCollector';
import type {
  MockMovementSensorPlaybackState,
  MockMovementSensorScenarioId,
  MockMovementSensorState,
} from './mockSensorTypes';
import { getMockMovementSensorScenario } from './scenarios';

type MockMovementSensorAdapterOptions = {
  scenarioId?: MockMovementSensorScenarioId;
  batchIntervalMs?: number;
  batchLeadMs?: number;
};

export class MockMovementSensorAdapter implements MovementSensorAdapter {
  private readonly sampleListeners = new Set<(sample: RawSensorSample) => void>();
  private readonly stateListeners = new Set<(state: MockMovementSensorState) => void>();
  private readonly batchIntervalMs: number;
  private readonly batchLeadMs: number;
  private scenarioId: MockMovementSensorScenarioId;
  private playbackState: MockMovementSensorPlaybackState = 'stopped';
  private currentBatchIndex = 0;
  private currentPedometerSteps: number | null = 0;
  private startTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(options: MockMovementSensorAdapterOptions = {}) {
    this.scenarioId = options.scenarioId ?? 'stationary';
    this.batchIntervalMs = options.batchIntervalMs ?? 250;
    this.batchLeadMs = options.batchLeadMs ?? 10;
    this.currentPedometerSteps = getMockMovementSensorScenario(this.scenarioId).initialPedometerSteps;
  }

  async subscribe(
    onSample: (sample: RawSensorSample) => void,
  ): Promise<readonly SensorSubscription[]> {
    this.sampleListeners.add(onSample);
    return [
      {
        remove: () => {
          this.sampleListeners.delete(onSample);
        },
      },
    ];
  }

  subscribeState(listener: (state: MockMovementSensorState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  setScenario(scenarioId: MockMovementSensorScenarioId): void {
    if (scenarioId === this.scenarioId) {
      return;
    }
    this.clearPlaybackTimers();
    this.scenarioId = scenarioId;
    this.currentBatchIndex = 0;
    this.currentPedometerSteps = getMockMovementSensorScenario(scenarioId).initialPedometerSteps;
    this.playbackState = 'stopped';
    this.notifyStateListeners();
  }

  start(): void {
    if (this.playbackState === 'running') {
      return;
    }

    const scenario = getMockMovementSensorScenario(this.scenarioId);
    if (this.currentBatchIndex >= scenario.batches.length) {
      this.currentBatchIndex = 0;
      this.currentPedometerSteps = scenario.initialPedometerSteps;
    }

    this.playbackState = 'running';
    this.notifyStateListeners();
    this.schedulePlayback();
  }

  pause(): void {
    if (this.playbackState !== 'running') {
      return;
    }
    this.clearPlaybackTimers();
    this.playbackState = 'paused';
    this.notifyStateListeners();
  }

  resume(): void {
    if (this.playbackState !== 'paused') {
      return;
    }
    this.playbackState = 'running';
    this.notifyStateListeners();
    this.schedulePlayback();
  }

  reset(): void {
    this.clearPlaybackTimers();
    this.currentBatchIndex = 0;
    this.currentPedometerSteps = getMockMovementSensorScenario(this.scenarioId).initialPedometerSteps;
    this.playbackState = 'stopped';
    this.notifyStateListeners();
  }

  stop(): void {
    this.clearPlaybackTimers();
    this.playbackState = 'stopped';
    this.notifyStateListeners();
  }

  advanceOneBatch(): void {
    const scenario = getMockMovementSensorScenario(this.scenarioId);
    const batch = scenario.batches[this.currentBatchIndex];
    if (!batch) {
      this.clearPlaybackTimers();
      this.playbackState = 'completed';
      this.notifyStateListeners();
      return;
    }

    batch.samples.forEach((sample) => {
      if (sample.kind === 'pedometer' && Number.isFinite(sample.steps)) {
        this.currentPedometerSteps = sample.steps;
      }
      this.sampleListeners.forEach((listener) => listener(sample));
    });
    this.currentBatchIndex += 1;

    if (this.currentBatchIndex >= scenario.batches.length) {
      this.clearPlaybackTimers();
      this.playbackState = 'completed';
    }

    this.notifyStateListeners();
  }

  getState(): MockMovementSensorState {
    const scenario = getMockMovementSensorScenario(this.scenarioId);
    return {
      scenarioId: this.scenarioId,
      playbackState: this.playbackState,
      currentBatchIndex: this.currentBatchIndex,
      totalBatches: scenario.batches.length,
      currentPedometerSteps: this.currentPedometerSteps,
    };
  }

  private schedulePlayback(): void {
    this.clearPlaybackTimers();
    this.startTimeoutHandle = setTimeout(() => {
      if (this.playbackState !== 'running') {
        return;
      }
      this.advanceOneBatch();
      if (this.playbackState !== 'running') {
        return;
      }
      this.intervalHandle = setInterval(() => {
        if (this.playbackState !== 'running') {
          return;
        }
        this.advanceOneBatch();
      }, this.batchIntervalMs);
    }, this.batchLeadMs);
  }

  private clearPlaybackTimers(): void {
    if (this.startTimeoutHandle !== null) {
      clearTimeout(this.startTimeoutHandle);
      this.startTimeoutHandle = null;
    }
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private notifyStateListeners(): void {
    const state = this.getState();
    this.stateListeners.forEach((listener) => listener(state));
  }
}
