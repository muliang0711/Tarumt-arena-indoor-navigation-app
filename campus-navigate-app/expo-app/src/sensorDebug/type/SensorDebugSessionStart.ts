import type { PdrPipelineConfig } from '../../pdr';

export type SensorDebugSessionStart = {
  configSnapshot: {
    pdr: PdrPipelineConfig;
    rawMotion: {
      flushIntervalMs: number;
      headingUpdateIntervalMs: number;
      sensorUpdateIntervalMs: number;
    };
  };
  sessionId: string;
  startedAtMs: number;
};
