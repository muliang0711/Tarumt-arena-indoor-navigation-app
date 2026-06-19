import assert from 'node:assert/strict';
import test from 'node:test';

import type { RawSensorSample } from '../mapEngine/shared';
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
