import type {
  PitchClass,
  NoteName,
  ChordQuality,
  ChordDefinition,
  ChordVoicing,
} from './chordData.types';

export const NOTE_TO_PC: Record<NoteName, PitchClass> = {
  'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
  'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
};

export const PC_TO_NOTE: Record<PitchClass, NoteName> = {
  0: 'C', 1: 'C#', 2: 'D', 3: 'D#', 4: 'E', 5: 'F',
  6: 'F#', 7: 'G', 8: 'G#', 9: 'A', 10: 'A#', 11: 'B',
};

/** Semitone intervals from root for each chord quality */
const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
};

const QUALITY_LABELS: Record<ChordQuality, string> = {
  major: '',
  minor: 'm',
};

/** Convert MIDI note number to Hz (A4 = 69 = 440 Hz) */
function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function makeChordLabel(root: string, quality: ChordQuality): string {
  return `${root}${QUALITY_LABELS[quality]}`;
}

export function buildVoicing(
  rootPitchClass: PitchClass,
  quality: ChordQuality,
  octave = 3,
): ChordVoicing {
  const intervals = QUALITY_INTERVALS[quality];
  const baseMidi = 12 * (octave + 1) + rootPitchClass;

  const frequencies: number[] = [];
  const pitchClasses: PitchClass[] = [];

  for (const interval of intervals) {
    const midi = baseMidi + interval;
    frequencies.push(midiToHz(midi));
    pitchClasses.push(((rootPitchClass + interval) % 12) as PitchClass);
  }

  return { frequencies, pitchClasses };
}

/** Build a ChordDefinition from a display name, root NoteName, and quality */
export function makeChordDefinition(
  displayName: string,
  root: NoteName,
  quality: ChordQuality,
): ChordDefinition {
  return {
    root,
    rootPitchClass: NOTE_TO_PC[root],
    quality,
    label: displayName,
  };
}

/** Circle of Fifths entries for UI — outer ring (major) */
export const CIRCLE_MAJOR: { displayName: string; root: NoteName; quality: ChordQuality }[] = [
  { displayName: 'C',  root: 'C',  quality: 'major' },
  { displayName: 'G',  root: 'G',  quality: 'major' },
  { displayName: 'D',  root: 'D',  quality: 'major' },
  { displayName: 'A',  root: 'A',  quality: 'major' },
  { displayName: 'E',  root: 'E',  quality: 'major' },
  { displayName: 'B',  root: 'B',  quality: 'major' },
  { displayName: 'F#', root: 'F#', quality: 'major' },
  { displayName: 'Db', root: 'C#', quality: 'major' },
  { displayName: 'Ab', root: 'G#', quality: 'major' },
  { displayName: 'Eb', root: 'D#', quality: 'major' },
  { displayName: 'Bb', root: 'A#', quality: 'major' },
  { displayName: 'F',  root: 'F',  quality: 'major' },
];

/** Circle of Fifths entries for UI — inner ring (relative minor) */
export const CIRCLE_MINOR: { displayName: string; root: NoteName; quality: ChordQuality }[] = [
  { displayName: 'Am',  root: 'A',  quality: 'minor' },
  { displayName: 'Em',  root: 'E',  quality: 'minor' },
  { displayName: 'Bm',  root: 'B',  quality: 'minor' },
  { displayName: 'F#m', root: 'F#', quality: 'minor' },
  { displayName: 'C#m', root: 'C#', quality: 'minor' },
  { displayName: 'G#m', root: 'G#', quality: 'minor' },
  { displayName: 'Ebm', root: 'D#', quality: 'minor' },
  { displayName: 'Bbm', root: 'A#', quality: 'minor' },
  { displayName: 'Fm',  root: 'F',  quality: 'minor' },
  { displayName: 'Cm',  root: 'C',  quality: 'minor' },
  { displayName: 'Gm',  root: 'G',  quality: 'minor' },
  { displayName: 'Dm',  root: 'D',  quality: 'minor' },
];
