import assert from 'node:assert/strict';
import test from 'node:test';

import type { RawSensorSample } from '../mapEngine/shared';
import { createExpoMovementSensorAdapterCore as createExpoMovementSensorAdapter } from './expoMovementSensorAdapterCore';
import {
  RealPedometerMonitor,
  type PedometerDiagnosticState,
} from './realPedometerMonitor';

type PermissionResponse = {
  granted: boolean;
  canAskAgain?: boolean;
  status?: 'granted' | 'denied' | 'undetermined';
};

class FakePedometerDependency {
  availability: boolean | Error = true;
  permission: PermissionResponse = {
    granted: true,
    canAskAgain: true,
    status: 'granted',
  };
  requestPermission: PermissionResponse = {
    granted: true,
    canAskAgain: true,
    status: 'granted',
  };
  watchError: Error | null = null;
  watchCount = 0;
  removeCount = 0;
  listener: ((result: { steps: number }) => void) | null = null;

  async isAvailableAsync(): Promise<boolean> {
    if (this.availability instanceof Error) {
      throw this.availability;
    }
    return this.availability;
  }

  async getPermissionsAsync(): Promise<PermissionResponse> {
    return this.permission;
  }

  async requestPermissionsAsync(): Promise<PermissionResponse> {
    return this.requestPermission;
  }

  watchStepCount(listener: (result: { steps: number }) => void) {
    if (this.watchError) {
      throw this.watchError;
    }
    this.watchCount += 1;
    this.listener = listener;
    return {
      remove: () => {
        this.removeCount += 1;
        if (this.listener === listener) {
          this.listener = null;
        }
      },
    };
  }

  emit(steps: number) {
    this.listener?.({ steps });
  }
}

class FakeDeviceSensor {
  availability: boolean | Error = true;
  permission: PermissionResponse = { granted: true, status: 'granted' };
  requestPermission: PermissionResponse = { granted: true, status: 'granted' };
  listenerError: Error | null = null;
  availabilityCheckCount = 0;
  listener: ((measurement: any) => void) | null = null;
  private availabilityPromise: Promise<boolean> | null = null;
  private resolveAvailabilityPromise: ((value: boolean) => void) | null = null;

  deferAvailability() {
    this.availabilityPromise = new Promise((resolve) => {
      this.resolveAvailabilityPromise = resolve;
    });
  }

  resolveAvailability(value: boolean) {
    this.resolveAvailabilityPromise?.(value);
  }

  async isAvailableAsync(): Promise<boolean> {
    this.availabilityCheckCount += 1;
    if (this.availabilityPromise) {
      return this.availabilityPromise;
    }
    if (this.availability instanceof Error) {
      throw this.availability;
    }
    return this.availability;
  }

  async getPermissionsAsync(): Promise<PermissionResponse> {
    return this.permission;
  }

  async requestPermissionsAsync(): Promise<PermissionResponse> {
    return this.requestPermission;
  }

  setUpdateInterval(): void {}

  addListener(listener: (measurement: any) => void) {
    if (this.listenerError) {
      throw this.listenerError;
    }
    this.listener = listener;
    return {
      remove: () => {
        if (this.listener === listener) {
          this.listener = null;
        }
      },
    };
  }

  emit(measurement: any) {
    this.listener?.(measurement);
  }
}

function lastState(states: readonly PedometerDiagnosticState[]): PedometerDiagnosticState {
  assert.ok(states.length > 0);
  return states[states.length - 1];
}

test('records permission state, subscription start, and live pedometer events', async () => {
  const pedometer = new FakePedometerDependency();
  const states: PedometerDiagnosticState[] = [];
  const samples: RawSensorSample[] = [];
  const monitor = new RealPedometerMonitor({
    pedometer,
    now: () => 1000,
  });

  monitor.subscribeState((state) => states.push(state));
  await monitor.start((sample) => samples.push(sample));
  pedometer.emit(12);

  assert.equal(lastState(states).availability, 'available');
  assert.equal(lastState(states).permissionStatus, 'granted');
  assert.equal(lastState(states).canAskAgain, true);
  assert.equal(lastState(states).subscriptionStarted, true);
  assert.equal(lastState(states).status, 'subscribed');
  assert.equal(lastState(states).rawCumulativeSteps, 12);
  assert.equal(lastState(states).lastEventTimestamp, 1000);
  assert.equal(samples.length, 1);
  assert.equal(samples[0].kind, 'pedometer');
  assert.equal(samples[0].steps, 12);
});

test('preserves a structured diagnostic state when permission is denied', async () => {
  const pedometer = new FakePedometerDependency();
  pedometer.permission = {
    granted: false,
    canAskAgain: false,
    status: 'denied',
  };
  pedometer.requestPermission = pedometer.permission;
  const monitor = new RealPedometerMonitor({
    pedometer,
    now: () => 2000,
  });

  await monitor.start(() => undefined);
  const state = monitor.getState();

  assert.equal(state.availability, 'available');
  assert.equal(state.permissionStatus, 'denied');
  assert.equal(state.canAskAgain, false);
  assert.equal(state.subscriptionStarted, false);
  assert.equal(state.status, 'permission-denied');
  assert.deepEqual(state.recentErrors, []);
});

test('preserves subscription errors instead of suppressing them', async () => {
  const pedometer = new FakePedometerDependency();
  pedometer.watchError = new Error('watch failed');
  const monitor = new RealPedometerMonitor({
    pedometer,
    now: () => 3000,
  });

  await monitor.start(() => undefined);
  const state = monitor.getState();

  assert.equal(state.subscriptionStarted, false);
  assert.equal(state.status, 'error');
  assert.equal(state.recentErrors.length, 1);
  assert.equal(state.recentErrors[0].stage, 'subscription');
  assert.match(state.recentErrors[0].message, /watch failed/);
});

test('retry replaces the existing pedometer subscription so only one remains active', async () => {
  const pedometer = new FakePedometerDependency();
  const monitor = new RealPedometerMonitor({
    pedometer,
    now: () => 4000,
  });

  await monitor.start(() => undefined);
  await monitor.retry();

  assert.equal(pedometer.watchCount, 2);
  assert.equal(pedometer.removeCount, 1);
  assert.equal(monitor.getState().subscriptionStarted, true);

  monitor.stop();
  assert.equal(pedometer.removeCount, 2);
  assert.equal(monitor.getState().subscriptionStarted, false);
});

test('starts independent device sensor availability checks concurrently', async () => {
  const accelerometer = new FakeDeviceSensor();
  const gyroscope = new FakeDeviceSensor();
  const magnetometer = new FakeDeviceSensor();
  const deviceMotion = new FakeDeviceSensor();
  accelerometer.deferAvailability();
  gyroscope.deferAvailability();

  const adapter = createExpoMovementSensorAdapter({
    Accelerometer: accelerometer,
    Gyroscope: gyroscope,
    Magnetometer: magnetometer,
    DeviceMotion: deviceMotion,
    Pedometer: new FakePedometerDependency(),
    now: () => 1000,
  });

  const subscriptionPromise = adapter.subscribe(() => undefined);
  await Promise.resolve();

  assert.equal(accelerometer.availabilityCheckCount, 1);
  assert.equal(gyroscope.availabilityCheckCount, 1);
  assert.equal(magnetometer.availabilityCheckCount, 1);
  assert.equal(deviceMotion.availabilityCheckCount, 1);

  accelerometer.resolveAvailability(true);
  gyroscope.resolveAvailability(true);
  const subscriptions = await subscriptionPromise;
  subscriptions.forEach((subscription) => subscription.remove());
});

test('reports unavailable, permission-denied, error, and receiving states per sensor', async () => {
  const accelerometer = new FakeDeviceSensor();
  accelerometer.availability = false;
  const gyroscope = new FakeDeviceSensor();
  gyroscope.permission = { granted: false, status: 'denied' };
  gyroscope.requestPermission = { granted: false, status: 'denied' };
  const magnetometer = new FakeDeviceSensor();
  magnetometer.listenerError = new Error('listener failed');
  const deviceMotion = new FakeDeviceSensor();

  const adapter = createExpoMovementSensorAdapter({
    Accelerometer: accelerometer,
    Gyroscope: gyroscope,
    Magnetometer: magnetometer,
    DeviceMotion: deviceMotion,
    Pedometer: new FakePedometerDependency(),
    now: () => 2000,
  });

  const subscriptions = await adapter.subscribe(() => undefined);
  deviceMotion.emit({
    acceleration: null,
    accelerationIncludingGravity: null,
    rotationRate: null,
    rotation: { alpha: 1, beta: 0, gamma: 0 },
    interval: 100,
  });

  const state = adapter.getDiagnosticState();
  assert.equal(state.sensors.accelerometer.status, 'unavailable');
  assert.equal(state.sensors.gyroscope.status, 'permission-denied');
  assert.equal(state.sensors.magnetometer.status, 'error');
  assert.equal(state.sensors.deviceMotion.status, 'receiving');
  assert.equal(state.sensors.deviceMotion.firstSampleAt, 2000);
  subscriptions.forEach((subscription) => subscription.remove());
});
