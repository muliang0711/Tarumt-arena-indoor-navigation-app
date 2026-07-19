import type { WifiPositionConfidence } from './WifiPositionConfidence';
import type { WrongWayRerouteReason } from './WrongWayRerouteReason';
import type { WrongWayRerouteState } from './WrongWayRerouteState';

export type WrongWayRerouteResult = {
  candidateNode: WifiPositionConfidence | null;
  currentNode: {
    nodeId: string;
    type: string;
  } | null;
  isConfidenceOffRoute: boolean;
  isAtJunction: boolean;
  isHeadingOpposite: boolean;
  isLegalGraphMovement: boolean;
  oppositeHeadingDurationMs: number;
  reason: WrongWayRerouteReason;
  shouldSuggestReroute: boolean;
  state: WrongWayRerouteState;
};
