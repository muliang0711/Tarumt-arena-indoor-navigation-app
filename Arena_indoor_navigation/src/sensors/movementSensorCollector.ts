import type { RawSensorSample } from '../mapEngine/map-controller';

export type SensorSubscription = {
  remove(): void;
};

export type MovementSensorAdapter = {
  subscribe(onSample: (sample: RawSensorSample) => void): Promise<readonly SensorSubscription[]>;
};

export type IntervalScheduler = {
  setInterval(callback: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
};

export type MovementSensorCollectorOptions = {
  capacity?: number;
  batchIntervalMs?: number;
  scheduler?: IntervalScheduler;
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
  private pendingSamples: RawSensorSample[] = [];
  private subscriptions: readonly SensorSubscription[] = [];
  private intervalHandle: unknown;
  private started = false;
  private lifecycleId = 0;

  constructor(
    private readonly adapter: MovementSensorAdapter,
    private readonly onBatch: (samples: readonly RawSensorSample[]) => void,
    options: MovementSensorCollectorOptions = {},
  ) {
    this.capacity = normalizePositiveInteger(options.capacity, 128);
    this.batchIntervalMs = normalizePositiveInteger(options.batchIntervalMs, 250);
    this.scheduler = options.scheduler ?? defaultScheduler;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;
    const lifecycleId = ++this.lifecycleId;
    this.intervalHandle = this.scheduler.setInterval(() => this.flush(), this.batchIntervalMs);

    try {
      const subscriptions = await this.adapter.subscribe((sample) => this.enqueue(sample));
      if (!this.started || lifecycleId !== this.lifecycleId) {
        subscriptions.forEach((subscription) => subscription.remove());
        return;
      }
      this.subscriptions = subscriptions;
    } catch {
      // Sensor availability and permission failures must leave the map usable.
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
  }

  flush(): void {
    if (!this.started || this.pendingSamples.length === 0) {
      return;
    }

    const batch = [...this.pendingSamples].sort((left, right) => left.timestamp - right.timestamp);
    this.pendingSamples = [];
    this.onBatch(batch);
  }

  getBufferedSampleCount(): number {
    return this.pendingSamples.length;
  }

  private enqueue(sample: RawSensorSample): void {
    if (!this.started || !Number.isFinite(sample.timestamp)) {
      return;
    }
    this.pendingSamples = [...this.pendingSamples, sample].slice(-this.capacity);
  }
}
