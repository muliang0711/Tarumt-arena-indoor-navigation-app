export type NavigationInputPolicy = {
  maxDerivedUpdatesPerSecond: number;
  maxRawSamplesInMemory: number;
  rawSensorRecordingEnabled: false;
  transientRawSensorBatchingEnabled: true;
};
