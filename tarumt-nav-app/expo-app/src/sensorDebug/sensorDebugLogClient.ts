import Constants from 'expo-constants';
import { NativeModules } from 'react-native';

import type {
  SensorDebugBatchLog,
  SensorDebugSessionStart,
  SensorDebugSessionStop,
} from './type';

const DEFAULT_SENSOR_DEBUG_PORT = 8787;
const SENSOR_DEBUG_TIMEOUT_MS = 1200;
const FAILURE_LOG_THROTTLE_MS = 5000;

let hasLoggedSessionUrl = false;
let lastFailureLogAtMs = 0;

export function sendSensorDebugSessionStart(event: SensorDebugSessionStart) {
  sendSensorDebugEvent('/session-start', event);
}

export function sendSensorDebugBatchLog(log: SensorDebugBatchLog) {
  sendSensorDebugEvent('/batch', log);
}

export function sendSensorDebugSessionStop(event: SensorDebugSessionStop) {
  sendSensorDebugEvent('/session-stop', event);
}

function sendSensorDebugEvent(path: string, payload: unknown) {
  if (!__DEV__) {
    return;
  }

  const baseUrl = resolveSensorDebugBaseUrl();
  if (!baseUrl) {
    logSensorDebugFailure('No sensor debug base URL could be resolved.');
    return;
  }

  if (path === '/session-start' && !hasLoggedSessionUrl) {
    hasLoggedSessionUrl = true;
    console.info(`[sensor-debug] sending logs to ${baseUrl}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SENSOR_DEBUG_TIMEOUT_MS);

  fetch(`${baseUrl}${path}`, {
    body: JSON.stringify(payload),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    signal: controller.signal,
  })
    .catch((error: unknown) => {
      logSensorDebugFailure(
        `POST ${baseUrl}${path} failed: ${getErrorMessage(error)}`,
      );
    })
    .finally(() => clearTimeout(timeout));
}

function resolveSensorDebugBaseUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_SENSOR_DEBUG_LOG_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  const host = resolvePackagerHost();
  return host ? `http://${host}:${DEFAULT_SENSOR_DEBUG_PORT}` : null;
}

function resolvePackagerHost() {
  const constantsHost = resolveConstantsHost();
  if (constantsHost) {
    return constantsHost;
  }

  const sourceCode = NativeModules.SourceCode as
    | {
        scriptURL?: string;
      }
    | undefined;
  const scriptUrl = sourceCode?.scriptURL;
  if (!scriptUrl) {
    return null;
  }

  const match = scriptUrl.match(/^[a-z]+:\/\/([^/:]+)/i);
  return match?.[1] ?? null;
}

function resolveConstantsHost() {
  const constants = Constants as {
    expoConfig?: {
      hostUri?: string;
    };
    manifest2?: {
      extra?: {
        expoClient?: {
          hostUri?: string;
        };
      };
    };
    manifest?: {
      debuggerHost?: string;
      hostUri?: string;
    };
  };
  const hostUri =
    constants.expoConfig?.hostUri ??
    constants.manifest2?.extra?.expoClient?.hostUri ??
    constants.manifest?.hostUri ??
    constants.manifest?.debuggerHost;

  if (!hostUri) {
    return null;
  }

  return stripPort(hostUri);
}

function stripPort(hostUri: string) {
  return hostUri.replace(/^[a-z]+:\/\//i, '').split(':')[0] ?? null;
}

function logSensorDebugFailure(message: string) {
  const nowMs = Date.now();
  if (nowMs - lastFailureLogAtMs < FAILURE_LOG_THROTTLE_MS) {
    return;
  }

  lastFailureLogAtMs = nowMs;
  console.warn(`[sensor-debug] ${message}`);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
