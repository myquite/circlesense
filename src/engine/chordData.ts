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

/**
 * Hardcoded G Major progression: G, C, D, Em.
 * Em stays minor regardless of quality selection (diatonically correct).
 */
export function getGMajorProgression(quality: ChordQuality): ProgressionDefinition {
  const roots: { note: NoteName; forceMinor: boolean }[] = [
    { note: 'G', forceMinor: false },
    { note: 'C', forceMinor: false },
    { note: 'D', forceMinor: false },
    { note: 'E', forceMinor: true },
  ];

  const chords: ChordDefinition[] = roots.map(({ note, forceMinor }) => {
    const q = forceMinor ? 'min7' : quality;
    return {
      root: note,
      rootPitchClass: NOTE_TO_PC[note],
      quality: q,
      label: makeChordLabel(note, q),
    };
  });

  return {
    name: 'G Major',
    key: 'G',
    chords,
  };
}
