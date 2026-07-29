import type { DerivedNavigationEstimate } from './DerivedNavigationEstimate';

export type DerivedEstimateBuffer = {
  acceptedEstimates: readonly DerivedNavigationEstimate[];
  droppedEstimateCount: number;
  maxSize: number;
};
