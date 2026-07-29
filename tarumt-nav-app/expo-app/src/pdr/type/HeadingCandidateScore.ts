export type HeadingCandidateScore = {
  headingDegrees: number;
  label: 'desired' | 'observed' | 'previous';
  score: number;
};
