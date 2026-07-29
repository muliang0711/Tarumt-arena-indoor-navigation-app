import { shouldAcceptDerivedEstimate } from './navigationInputPolicy';
import type {
  DerivedEstimateBuffer,
  DerivedEstimateIngestResult,
  DerivedNavigationEstimate,
  NavigationInputPolicy,
} from './type';

const DEFAULT_BUFFER_SIZE = 6;

export function createDerivedEstimateBuffer(input?: {
  maxSize?: number;
}): DerivedEstimateBuffer {
  return {
    acceptedEstimates: [],
    droppedEstimateCount: 0,
    maxSize: input?.maxSize ?? DEFAULT_BUFFER_SIZE,
  };
}

export function getLatestDerivedEstimate(
  buffer: DerivedEstimateBuffer,
): DerivedNavigationEstimate | null {
  return buffer.acceptedEstimates[buffer.acceptedEstimates.length - 1] ?? null;
}

export function ingestDerivedEstimate(input: {
  buffer: DerivedEstimateBuffer;
  estimate: DerivedNavigationEstimate;
  policy?: NavigationInputPolicy;
}): DerivedEstimateIngestResult {
  const previousEstimate = getLatestDerivedEstimate(input.buffer);
  const accepted = shouldAcceptDerivedEstimate({
    nextEstimate: input.estimate,
    policy: input.policy,
    previousEstimate,
  });

  if (!accepted) {
    return {
      accepted: false,
      acceptedEstimate: null,
      buffer: {
        ...input.buffer,
        droppedEstimateCount: input.buffer.droppedEstimateCount + 1,
      },
      reason: 'rate-limited',
    };
  }

  const acceptedEstimates = [
    ...input.buffer.acceptedEstimates,
    input.estimate,
  ].slice(-input.buffer.maxSize);

  return {
    accepted: true,
    acceptedEstimate: input.estimate,
    buffer: {
      ...input.buffer,
      acceptedEstimates,
    },
    reason: 'accepted',
  };
}
