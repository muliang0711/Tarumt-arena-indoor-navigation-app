import type { PdrPipelineDiagnostics } from '../../pdr';

export type SensorDebugBatchLog = {
  batchId: number;
  diagnostics: PdrPipelineDiagnostics;
  sessionId: string;
  timestampMs: number;
};
