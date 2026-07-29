export type WrongWayRerouteReason =
  | 'confidence-on-route'
  | 'heading-not-opposite'
  | 'illegal-graph-jump'
  | 'insufficient-confidence'
  | 'insufficient-opposite-duration'
  | 'junction-opposite-heading'
  | 'legal-off-route-movement'
  | 'not-at-junction'
  | 'opposite-heading';
