export type WrongWayRerouteConfig = {
  allowedHeadingDeviationDegrees: number;
  confidenceThreshold: number;
  expectedHeadingRoundDegrees: number;
  junctionCaptureRadiusPixels: number;
  junctionNodeType: string;
  minimumOppositeHeadingDurationMs: number;
  wrongWayCheckIntervalMs: number;
};
