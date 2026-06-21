import type { RawSensorSample } from '../mapEngine/shared';

export type SensorSubscription = {
  remove(): void;
};

export type MovementSensorAdapter = {
  subscribe(onSample: (sample: RawSensorSample) => void): Promise<readonly SensorSubscription[]>;
};

export type MovementSensorCollectorDiagnostic = {
  readonly status:
    | 'idle'
    | 'starting'
    | 'subscribed'
    | 'receiving'
    | 'stopped'
    | 'error';
  readonly startedAt: number | null;
  readonly subscribedAt: number | null;
  readonly firstSampleAt: number | null;
  readonly firstBatchAt: number | null;
};

export type IntervalScheduler = {
  setInterval(callback: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
};

export type MovementSensorCollectorOptions = {
  capacity?: number;
  batchIntervalMs?: number;
  scheduler?: IntervalScheduler;
  now?: () => number;
  onDiagnostic?: (diagnostic: MovementSensorCollectorDiagnostic) => void;
};

const defaultScheduler: IntervalScheduler = {
  setInterval: (callback, intervalMs) => globalThis.setInterval(callback, intervalMs),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
};

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.floor(value ?? fallback));
}

export class MovementSensorCollector {
  private readonly capacity: number;
  private readonly batchIntervalMs: number;
  private readonly scheduler: IntervalScheduler;
  private readonly now: () => number;
  private readonly onDiagnostic?: (diagnostic: MovementSensorCollectorDiagnostic) => void;
  private pendingSamples: RawSensorSample[] = [];
  private subscriptions: readonly SensorSubscription[] = [];
  private intervalHandle: unknown;
  private started = false;
  private lifecycleId = 0;
  private hasEmittedBatch = false;
  private diagnostic: MovementSensorCollectorDiagnostic = {
    status: 'idle',
    startedAt: null,
    subscribedAt: null,
    firstSampleAt: null,
    firstBatchAt: null,
  };

  constructor(
    private readonly adapter: MovementSensorAdapter,
    private readonly onBatch: (samples: readonly RawSensorSample[]) => void,
    options: MovementSensorCollectorOptions = {},
  ) {
    this.capacity = normalizePositiveInteger(options.capacity, 128);
    this.batchIntervalMs = normalizePositiveInteger(options.batchIntervalMs, 250);
    this.scheduler = options.scheduler ?? defaultScheduler;
    this.now = options.now ?? (() => Date.now());
    this.onDiagnostic = options.onDiagnostic;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;
    const lifecycleId = ++this.lifecycleId;
    const startedAt = this.now();
    this.pendingSamples = [];
    this.hasEmittedBatch = false;
    this.diagnostic = {
      status: 'starting',
      startedAt,
      subscribedAt: null,
      firstSampleAt: null,
      firstBatchAt: null,
    };
    this.notifyDiagnostic();
    this.intervalHandle = this.scheduler.setInterval(() => this.flush(), this.batchIntervalMs);

    try {
      const subscriptions = await this.adapter.subscribe((sample) => this.enqueue(sample));
      if (!this.started || lifecycleId !== this.lifecycleId) {
        subscriptions.forEach((subscription) => subscription.remove());
        return;
      }
      this.subscriptions = subscriptions;
      this.updateDiagnostic({
        status: this.diagnostic.firstSampleAt === null ? 'subscribed' : 'receiving',
        subscribedAt: this.now(),
      });
    } catch {
      // Sensor availability and permission failures must leave the map usable.
      if (this.started && lifecycleId === this.lifecycleId) {
        this.updateDiagnostic({ status: 'error' });
      }
    }
  }

  stop(): void {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.lifecycleId += 1;
    if (this.intervalHandle !== undefined) {
      this.scheduler.clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
    this.subscriptions.forEach((subscription) => subscription.remove());
    this.subscriptions = [];
    this.pendingSamples = [];
    this.updateDiagnostic({ status: 'stopped' });
  }

  flush(): void {
    if (!this.started || this.pendingSamples.length === 0) {
      return;
    }

    const batch = [...this.pendingSamples].sort((left, right) => left.timestamp - right.timestamp);
    this.pendingSamples = [];
    this.hasEmittedBatch = true;
    if (this.diagnostic.firstBatchAt === null) {
      this.updateDiagnostic({
        status: 'receiving',
        firstBatchAt: this.now(),
      });
    }
    this.onBatch(batch);
  }

  getBufferedSampleCount(): number {
    return this.pendingSamples.length;
  }

  private enqueue(sample: RawSensorSample): void {
    if (!this.started || !Number.isFinite(sample.timestamp)) {
      return;
    }
    if (this.diagnostic.firstSampleAt === null) {
      this.updateDiagnostic({
        status: 'receiving',
        firstSampleAt: this.now(),
      });
    }
    this.pendingSamples = [...this.pendingSamples, sample].slice(-this.capacity);
    if (!this.hasEmittedBatch) {
      this.flush();
    }
  }

  private updateDiagnostic(
    next: Partial<MovementSensorCollectorDiagnostic>,
  ): void {
    this.diagnostic = {
      ...this.diagnostic,
      ...next,
    };
    this.notifyDiagnostic();
  }

  private notifyDiagnostic(): void {
    this.onDiagnostic?.({ ...this.diagnostic });
  }
}
