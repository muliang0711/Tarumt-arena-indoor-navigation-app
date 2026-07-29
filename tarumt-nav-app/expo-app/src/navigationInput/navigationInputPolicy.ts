import type {
  DerivedNavigationEstimate,
  NavigationInputPolicy,
} from './type';

export const NAVIGATION_INPUT_POLICY: NavigationInputPolicy = {
  maxDerivedUpdatesPerSecond: 15,
  maxRawSamplesInMemory: 32,
  rawSensorRecordingEnabled: false,
  transientRawSensorBatchingEnabled: true,
};

export function assertRawSensorRecordingDisabled(
  policy: NavigationInputPolicy = NAVIGATION_INPUT_POLICY,
) {
  if (policy.rawSensorRecordingEnabled !== false) {
    throw new Error('Raw sensor recording must stay disabled.');
  }
}

export function assertTransientRawSensorBatchingAllowed(
  policy: NavigationInputPolicy = NAVIGATION_INPUT_POLICY,
) {
  if (policy.transientRawSensorBatchingEnabled !== true) {
    throw new Error('Transient raw sensor batching must stay enabled.');
  }
}

export function shouldAcceptDerivedEstimate(input: {
  nextEstimate: DerivedNavigationEstimate;
  previousEstimate: DerivedNavigationEstimate | null;
  policy?: NavigationInputPolicy;
}) {
  const policy = input.policy ?? NAVIGATION_INPUT_POLICY;
  assertRawSensorRecordingDisabled(policy);

  if (!input.previousEstimate) {
    return true;
  }

  const minimumIntervalMs = 1000 / policy.maxDerivedUpdatesPerSecond;
  return (
    input.nextEstimate.timestampMs - input.previousEstimate.timestampMs >=
    minimumIntervalMs
  );
}
