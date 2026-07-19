import type { NavigationTurn } from './NavigationTurn';

export type NavigationUiState = {
  currentSegment: string;
  distanceRemainingPixels: number;
  instruction: NavigationTurn;
  progressPercent: number;
  status: string;
};
