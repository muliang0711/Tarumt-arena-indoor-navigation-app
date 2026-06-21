import SourceCode from 'react-native/Libraries/NativeModules/specs/NativeSourceCode';

import type { MovementDebugSnapshot } from '../movementDebugModel';
import {
  createMovementDebugLogEntry,
  MOVEMENT_DEBUG_LOG_SERVER_PATH,
  resolveMovementDebugLogServerOrigin,
} from './movementDebugFileLog';

const isDevelopmentBuild =
  typeof __DEV__ !== 'undefined'
    ? __DEV__
    : process.env.NODE_ENV !== 'production';

const enableMovementFileLogging = true;

export async function sendMovementDebugLog(
  snapshot: MovementDebugSnapshot,
  sourceRawCumulativeSteps: number | null,
): Promise<void> {
  if (!isDevelopmentBuild || !enableMovementFileLogging) {
    return;
  }

  const scriptUrl = SourceCode.getConstants().scriptURL;
  const origin = resolveMovementDebugLogServerOrigin(scriptUrl);
  if (!origin) {
    return;
  }

  try {
    await fetch(`${origin}${MOVEMENT_DEBUG_LOG_SERVER_PATH}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(
        createMovementDebugLogEntry(snapshot, {
          sourceRawCumulativeSteps,
        }),
      ),
    });
  } catch {
    // Development-only logging failures must not affect the map or sensor pipeline.
  }
}
