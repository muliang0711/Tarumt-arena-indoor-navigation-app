import type { DerivedNavigationEstimate } from './DerivedNavigationEstimate';
import type { DerivedEstimateBuffer } from './DerivedEstimateBuffer';

export type DerivedEstimateIngestResult = {
  accepted: boolean;
  acceptedEstimate: DerivedNavigationEstimate | null;
  buffer: DerivedEstimateBuffer;
  reason: 'accepted' | 'rate-limited';
};
