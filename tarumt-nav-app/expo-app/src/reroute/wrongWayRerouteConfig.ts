import type { WrongWayRerouteConfig } from './type';

export const WRONG_WAY_CHECK_INTERVAL_MS = 1000;
export const WRONG_WAY_OPPOSITE_HEADING_DURATION_MS = 1000;

export const DEFAULT_WRONG_WAY_REROUTE_CONFIG: WrongWayRerouteConfig = {
  allowedHeadingDeviationDegrees: 90,
  confidenceThreshold: 0.65,
  expectedHeadingRoundDegrees: 90,
  junctionCaptureRadiusPixels: 36,
  junctionNodeType: 'junctions',
  minimumOppositeHeadingDurationMs: WRONG_WAY_OPPOSITE_HEADING_DURATION_MS,
  wrongWayCheckIntervalMs: WRONG_WAY_CHECK_INTERVAL_MS,
};
