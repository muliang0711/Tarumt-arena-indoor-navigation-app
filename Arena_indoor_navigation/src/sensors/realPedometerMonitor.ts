import type { RawSensorSample } from '../mapEngine/shared';
import type { SensorSubscription } from './movementSensorCollector';

type PedometerPermissionStatus =
  | 'unknown'
  | 'undetermined'
  | 'granted'
  | 'denied';

type PedometerAvailability =
  | 'unknown'
  | 'checking'
  | 'available'
  | 'unavailable';

export type PedometerDiagnosticStatus =
  | 'idle'
  | 'checking-availability'
  | 'checking-permission'
  | 'requesting-permission'
  | 'subscribing'
  | 'subscribed'
  | 'permission-denied'
  | 'unavailable'
  | 'error'
  | 'stopped';

export type PedometerDiagnosticError = {
  stage: 'availability' | 'permission' | 'subscription' | 'event';
  message: string;
  name?: string;
  code?: string;
  timestamp: number;
};

export type PedometerDiagnosticState = {
  availability: PedometerAvailability;
  permissionStatus: PedometerPermissionStatus;
  canAskAgain: boolean | null;
  subscriptionStarted: boolean;
  status: PedometerDiagnosticStatus;
  lastSubscriptionAttemptAt: number | null;
  lastEventTimestamp: number | null;
  rawCumulativeSteps: number | null;
  recentErrors: readonly PedometerDiagnosticError[];
};

type PermissionResponse = {
  granted: boolean;
  canAskAgain?: boolean;
  status?: 'granted' | 'denied' | 'undetermined';
};

type PedometerDependency = {
  isAvailableAsync(): Promise<boolean>;
  getPermissionsAsync(): Promise<PermissionResponse>;
  requestPermissionsAsync(): Promise<PermissionResponse>;
  watchStepCount(listener: (result: { steps: number }) => void): SensorSubscription;
};

type RealPedometerMonitorDependencies = {
  pedometer: PedometerDependency;
  now?: () => number;
};

const MAX_ERROR_COUNT = 5;

function defaultState(): PedometerDiagnosticState {
  return {
    availability: 'unknown',
    permissionStatus: 'unknown',
    canAskAgain: null,
    subscriptionStarted: false,
    status: 'idle',
    lastSubscriptionAttemptAt: null,
    lastEventTimestamp: null,
    rawCumulativeSteps: null,
    recentErrors: [],
  };
}

function permissionStatusFromResponse(
  permission: PermissionResponse,
): PedometerPermissionStatus {
  if (permission.status) {
    return permission.status;
  }
  return permission.granted ? 'granted' : 'denied';
}

function errorToDiagnostic(
  error: unknown,
  stage: PedometerDiagnosticError['stage'],
  now: () => number,
): PedometerDiagnosticError {
  if (error instanceof Error) {
    return {
      stage,
      message: error.message,
      name: error.name,
      code:
        'code' in error && typeof error.code === 'string'
          ? error.code
          : undefined,
      timestamp: now(),
    };
  }

  return {
    stage,
    message: String(error),
    timestamp: now(),
  };
}

export class RealPedometerMonitor {
  private readonly pedometer: PedometerDependency;
  private readonly now: () => number;
  private readonly listeners = new Set<(state: PedometerDiagnosticState) => void>();
  private state: PedometerDiagnosticState = defaultState();
  private activeSubscription: SensorSubscription | null = null;
  private onSample: ((sample: RawSensorSample) => void) | null = null;
  private sampleSequence = 0;
  private lifecycleId = 0;

  constructor(dependencies: RealPedometerMonitorDependencies) {
    this.pedometer = dependencies.pedometer;
    this.now = dependencies.now ?? (() => Date.now());
  }

  subscribeState(listener: (state: PedometerDiagnosticState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): PedometerDiagnosticState {
    return this.state;
  }

  async start(onSample: (sample: RawSensorSample) => void): Promise<SensorSubscription> {
    this.onSample = onSample;
    await this.attachSubscription();

    return {
      remove: () => this.stop(),
    };
  }

  async retry(): Promise<void> {
    if (this.onSample === null) {
      return;
    }

    await this.attachSubscription();
  }

  stop(): void {
    this.lifecycleId += 1;
    this.removeActiveSubscription();
    this.updateState({
      subscriptionStarted: false,
      status: 'stopped',
    });
  }

  private async attachSubscription(): Promise<void> {
    const lifecycleId = ++this.lifecycleId;
    const onSample = this.onSample;
    if (onSample === null) {
      return;
    }

    this.removeActiveSubscription();
    this.updateState({
      availability: 'checking',
      status: 'checking-availability',
      subscriptionStarted: false,
      lastSubscriptionAttemptAt: this.now(),
    });

    let isAvailable: boolean;
    try {
      isAvailable = await this.pedometer.isAvailableAsync();
    } catch (error) {
      if (lifecycleId !== this.lifecycleId) {
        return;
      }
      this.recordError('availability', error);
      return;
    }

    if (lifecycleId !== this.lifecycleId) {
      return;
    }

    if (!isAvailable) {
      this.updateState({
        availability: 'unavailable',
        status: 'unavailable',
        subscriptionStarted: false,
      });
      return;
    }

    this.updateState({
      availability: 'available',
      status: 'checking-permission',
    });

    let permission: PermissionResponse;
    try {
      permission = await this.pedometer.getPermissionsAsync();
      this.updateState({
        permissionStatus: permissionStatusFromResponse(permission),
        canAskAgain: permission.canAskAgain ?? null,
      });

      if (!permission.granted) {
        this.updateState({
          status: 'requesting-permission',
        });
        permission = await this.pedometer.requestPermissionsAsync();
      }
    } catch (error) {
      if (lifecycleId !== this.lifecycleId) {
        return;
      }
      this.recordError('permission', error);
      return;
    }

    if (lifecycleId !== this.lifecycleId) {
      return;
    }

    this.updateState({
      permissionStatus: permissionStatusFromResponse(permission),
      canAskAgain: permission.canAskAgain ?? null,
    });

    if (!permission.granted) {
      this.updateState({
        subscriptionStarted: false,
        status: 'permission-denied',
      });
      return;
    }

    this.updateState({
      status: 'subscribing',
    });

    try {
      const subscription = this.pedometer.watchStepCount(({ steps }) => {
        const timestamp = this.now();
        this.updateState({
          lastEventTimestamp: timestamp,
          rawCumulativeSteps: steps,
        });

        try {
          this.sampleSequence += 1;
          onSample({
            id: `pedometer:${this.sampleSequence}`,
            kind: 'pedometer',
            timestamp,
            steps,
          });
        } catch (error) {
          this.recordError('event', error);
        }
      });

      if (lifecycleId !== this.lifecycleId) {
        subscription.remove();
        return;
      }

      this.activeSubscription = subscription;
      this.updateState({
        subscriptionStarted: true,
        status: 'subscribed',
      });
    } catch (error) {
      if (lifecycleId !== this.lifecycleId) {
        return;
      }
      this.recordError('subscription', error);
    }
  }

  private removeActiveSubscription(): void {
    this.activeSubscription?.remove();
    this.activeSubscription = null;
  }

  private recordError(
    stage: PedometerDiagnosticError['stage'],
    error: unknown,
  ): void {
    const diagnosticError = errorToDiagnostic(error, stage, this.now);
    this.updateState({
      subscriptionStarted: false,
      status: 'error',
      recentErrors: [...this.state.recentErrors, diagnosticError].slice(-MAX_ERROR_COUNT),
    });
  }

  private updateState(nextState: Partial<PedometerDiagnosticState>): void {
    this.state = {
      ...this.state,
      ...nextState,
    };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
