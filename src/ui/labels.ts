import type { PracticeTarget } from '../engine/judge.types';

/** The one name for each practice target, used wherever a target is shown. */
export const TARGET_NAMES: Record<PracticeTarget, string> = {
  chord: 'All chord tones',
  third: '3rd only',
  guide: 'Guide tones (3rd and 7th)',
};
