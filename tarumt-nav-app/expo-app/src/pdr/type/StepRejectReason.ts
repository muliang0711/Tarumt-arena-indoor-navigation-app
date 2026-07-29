export type StepRejectReason =
  | 'ACCEPTED'
  | 'LOW_PEAK'
  | 'NO_QUIET_SAMPLE'
  | 'NO_SAMPLES'
  | 'PHONE_ROTATION'
  | 'SHAKE_TOO_HIGH'
  | 'TOO_SOON_AFTER_LAST_STEP';
