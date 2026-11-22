import type { PitchClass } from './chordData.types';

/** Major scale interval pattern in semitones */
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;

/** Natural minor scale interval pattern in semitones */
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10] as const;

/** Generate the set of pitch classes for any major scale */
export function getMajorScale(root: PitchClass): Set<PitchClass> {
  return new Set(
    MAJOR_INTERVALS.map((i) => ((root + i) % 12) as PitchClass),
  );
}

/** Generate the set of pitch classes for any natural minor scale */
export function getNaturalMinorScale(root: PitchClass): Set<PitchClass> {
  return new Set(
    MINOR_INTERVALS.map((i) => ((root + i) % 12) as PitchClass),
  );
}

/** Default display spelling for a pitch class with no chord context (flats, except F♯). */
export const PC_TO_NOTE_NAME: Record<PitchClass, string> = {
  0: 'C',
  1: 'D♭',
  2: 'D',
  3: 'E♭',
  4: 'E',
  5: 'F',
  6: 'F♯',
  7: 'G',
  8: 'A♭',
  9: 'A',
  10: 'B♭',
  11: 'B',
};
