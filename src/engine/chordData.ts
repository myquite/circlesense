import type {
  PitchClass,
  NoteName,
  ChordQuality,
  ChordDefinition,
  ChordVoicing,
} from './chordData.types';
import { PC_TO_NOTE_NAME } from './scaleData';

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
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  dominant7: [0, 4, 7, 10],
};

const QUALITY_LABELS: Record<ChordQuality, string> = {
  major: '',
  minor: 'm',
  major7: 'maj7',
  minor7: 'm7',
  dominant7: '7',
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

type Step = [semitonesAboveTonic: number, quality: ChordQuality];
const I7: Step = [0, 'dominant7'];
const IV7: Step = [5, 'dominant7'];
const V7: Step = [7, 'dominant7'];
const Im7: Step = [0, 'minor7'];
const IVm7: Step = [5, 'minor7'];

/**
 * Functional exercises, one chord per step, written relative to the tonic so they
 * transpose to any key. Blues forms are twelve steps; transition loops isolate one
 * change from the form so it can be repeated.
 */
export const EXERCISES = {
  'ii-v-i': { name: 'ii–V–I', group: 'Jazz', steps: [[2, 'minor7'], V7, [0, 'major7']] },
  turnaround: { name: 'I–vi–ii–V', group: 'Jazz', steps: [[0, 'major7'], [9, 'minor7'], [2, 'minor7'], V7] },
  blues: { name: '12-bar blues', group: 'Blues forms', steps: [I7, I7, I7, I7, IV7, IV7, I7, I7, V7, IV7, I7, V7] },
  'blues-quick': { name: 'Quick-change blues', group: 'Blues forms', steps: [I7, IV7, I7, I7, IV7, IV7, I7, I7, V7, IV7, I7, V7] },
  // One chord per bar: VI7 leads to the ii–V in bars 9–10. Diminished passing chords are left out.
  'blues-jazz': { name: 'Jazz blues', group: 'Blues forms', steps: [I7, IV7, I7, I7, IV7, IV7, I7, [9, 'dominant7'], [2, 'minor7'], V7, I7, V7] },
  'blues-minor': { name: 'Minor blues', group: 'Blues forms', steps: [Im7, Im7, Im7, Im7, IVm7, IVm7, Im7, Im7, [8, 'dominant7'], V7, Im7, V7] },
  'blues-i-iv': { name: 'I7–IV7 (bars 4–5)', group: 'Blues transitions', steps: [I7, IV7] },
  'blues-v-iv-i': { name: 'V7–IV7–I7 (bars 9–11)', group: 'Blues transitions', steps: [V7, IV7, I7] },
  'blues-i-v': { name: 'I7–V7 turnaround (bars 11–12)', group: 'Blues transitions', steps: [I7, V7] },
} satisfies Record<string, { name: string; group: string; steps: Step[] }>;

export type ExerciseKind = keyof typeof EXERCISES;
export const EXERCISE_KINDS = Object.keys(EXERCISES) as ExerciseKind[];

/** Find the preset and key a progression came from, if it is still an unedited preset. */
export function matchExercise(progression: ChordDefinition[]): { tonic: PitchClass; kind: ExerciseKind } | null {
  if (progression.length === 0) return null;
  for (const kind of EXERCISE_KINDS) {
    for (let tonic = 0; tonic < 12; tonic++) {
      const exercise = buildExercise(tonic as PitchClass, kind);
      if (exercise.length === progression.length && exercise.every((chord, i) =>
        chord.rootPitchClass === progression[i].rootPitchClass && chord.quality === progression[i].quality)) {
        return { tonic: tonic as PitchClass, kind };
      }
    }
  }
  return null;
}

/** Transpose a functional exercise to a chosen tonic. */
export function buildExercise(tonic: PitchClass, kind: ExerciseKind): ChordDefinition[] {
  const steps: Step[] = EXERCISES[kind].steps;
  return steps.map(([interval, quality]) => {
    const root = PC_TO_NOTE[((tonic + interval) % 12) as PitchClass];
    const displayRoot = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][NOTE_TO_PC[root]];
    return makeChordDefinition(makeChordLabel(displayRoot, quality), root, quality);
  });
}

/** Spell stacked thirds from the displayed root, including flat keys. */
export function chordToneNames(chord: ChordDefinition): string[] {
  const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const naturals = [0, 2, 4, 5, 7, 9, 11];
  const rootLetter = letters.indexOf(chord.label[0]);
  return buildVoicing(chord.rootPitchClass, chord.quality).pitchClasses.map((pc, i) => {
    const index = (rootLetter + 2 * i) % 7;
    const offset = ((pc - naturals[index] + 18) % 12) - 6;
    return letters[index] + (offset > 0 ? '♯'.repeat(offset) : '♭'.repeat(-offset));
  });
}

/** Chord labels are stored in ASCII (Bbmaj7, F#m); show them with real accidentals. */
export function formatChordLabel(label: string): string {
  return label.replace(/^([A-G])b/, '$1♭').replace(/^([A-G])#/, '$1♯');
}

/** Name a pitch class the way the chord spells it, so E♭ over Cm7 never reads as D♯. */
export function spellPitchClass(pitchClass: PitchClass, chord?: ChordDefinition | null): string {
  if (chord) {
    const index = buildVoicing(chord.rootPitchClass, chord.quality).pitchClasses.indexOf(pitchClass);
    if (index >= 0) return chordToneNames(chord)[index];
  }
  return PC_TO_NOTE_NAME[pitchClass];
}

/** Whether a progression chord belongs to a circle node: same root, same major/minor family. */
export function matchesCircleEntry(chord: ChordDefinition, root: NoteName, quality: ChordQuality): boolean {
  return chord.root === root && chord.quality.startsWith('minor') === quality.startsWith('minor');
}

/**
 * Tapping a circle node toggles its chord: an unlit node appends its triad, a lit node
 * removes every chord it stands for (so the node goes dark). Returns what was removed.
 */
export function toggleCircleChord(
  progression: ChordDefinition[],
  displayName: string,
  root: NoteName,
  quality: ChordQuality,
): { next: ChordDefinition[]; removed: ChordDefinition[] } {
  const removed = progression.filter((chord) => matchesCircleEntry(chord, root, quality));
  if (removed.length > 0) {
    return { next: progression.filter((chord) => !matchesCircleEntry(chord, root, quality)), removed };
  }
  return { next: [...progression, makeChordDefinition(displayName, root, quality)], removed };
}

/**
 * Lights every circle node: appends the triad for each node not already in the
 * progression (majors, then minors, in circle order), keeping existing chords as they are.
 */
export function selectAllCircleChords(progression: ChordDefinition[]): ChordDefinition[] {
  const missing = [...CIRCLE_MAJOR, ...CIRCLE_MINOR].filter(
    (entry) => !progression.some((chord) => matchesCircleEntry(chord, entry.root, entry.quality)),
  );
  return [...progression, ...missing.map((entry) => makeChordDefinition(entry.displayName, entry.root, entry.quality))];
}
