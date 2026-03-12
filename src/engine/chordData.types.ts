/** Pitch class: 0 = C, 1 = C#, ... 11 = B */
export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type ChordQuality = 'major' | 'minor';

export type NoteName =
  | 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F'
  | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export interface ChordDefinition {
  root: NoteName;
  rootPitchClass: PitchClass;
  quality: ChordQuality;
  label: string;
}

export interface ChordVoicing {
  frequencies: number[];
  pitchClasses: PitchClass[];
}
