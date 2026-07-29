export function createSensorDebugSessionId(nowMs: number) {
  return `step-test-${new Date(nowMs)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[:.]/g, '-')}`;
}
