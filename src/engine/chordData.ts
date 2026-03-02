import type {
  PitchClass,
  NoteName,
  ChordQuality,
  ChordDefinition,
  ChordVoicing,
  ProgressionDefinition,
} from './chordData.types';

export const NOTE_TO_PC: Record<NoteName, PitchClass> = {
  'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
  'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
};

/** Semitone intervals from root for each chord quality */
const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  maj7: [0, 4, 7, 11],
  dom7: [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  dim:  [0, 3, 6, 9],
};

const QUALITY_LABELS: Record<ChordQuality, string> = {
  maj7: 'maj7',
  dom7: '7',
  min7: 'm7',
  dim:  'dim',
};

/** Convert MIDI note number to Hz (A4 = 69 = 440 Hz) */
function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function makeChordLabel(root: NoteName, quality: ChordQuality): string {
  return `${root}${QUALITY_LABELS[quality]}`;
}

export function buildVoicing(
  rootPitchClass: PitchClass,
  quality: ChordQuality,
  octave = 3,
): ChordVoicing {
  const intervals = QUALITY_INTERVALS[quality];
  const baseMidi = 12 * (octave + 1) + rootPitchClass; // C3 = MIDI 48

  const frequencies: number[] = [];
  const pitchClasses: PitchClass[] = [];

  for (const interval of intervals) {
    const midi = baseMidi + interval;
    frequencies.push(midiToHz(midi));
    pitchClasses.push(((rootPitchClass + interval) % 12) as PitchClass);
  }

  return { frequencies, pitchClasses };
}

/** I-IV-V-vi degree offsets in semitones from the root */
const PROGRESSION_DEGREES: { offset: number; forceMinor: boolean }[] = [
  { offset: 0, forceMinor: false },   // I
  { offset: 5, forceMinor: false },   // IV
  { offset: 7, forceMinor: false },   // V
  { offset: 9, forceMinor: true },    // vi (always minor)
];

const PC_TO_NOTE: Record<PitchClass, NoteName> = {
  0: 'C', 1: 'C#', 2: 'D', 3: 'D#', 4: 'E', 5: 'F',
  6: 'F#', 7: 'G', 8: 'G#', 9: 'A', 10: 'A#', 11: 'B',
};

/**
 * Build I-IV-V-vi progression for any major key.
 * vi chord forced to min7 (diatonically correct).
 */
export function getProgressionForKey(key: NoteName, quality: ChordQuality): ProgressionDefinition {
  const rootPc = NOTE_TO_PC[key];

  const chords: ChordDefinition[] = PROGRESSION_DEGREES.map(({ offset, forceMinor }) => {
    const pc = ((rootPc + offset) % 12) as PitchClass;
    const note = PC_TO_NOTE[pc];
    const q = forceMinor ? 'min7' : quality;
    return {
      root: note,
      rootPitchClass: pc,
      quality: q,
      label: makeChordLabel(note, q),
    };
  });

  return {
    name: `${key} Major`,
    key,
    chords,
  };
}

/** Alias for backward compatibility */
export function getGMajorProgression(quality: ChordQuality): ProgressionDefinition {
  return getProgressionForKey('G', quality);
}
