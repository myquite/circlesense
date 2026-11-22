import { NOTE_TO_PC, buildExercise } from '../engine/chordData';
import type { PracticeTarget } from '../engine/judge.types';
import type { ChordDefinition } from '../engine/chordData.types';
import type { PlaybackDirection, PlaybackMode, ToneType } from '../audio/playbackEngine.types';

export interface Settings {
  target: PracticeTarget;
  bpm: number;
  barLength: 1 | 2 | 3 | 4;
  direction: PlaybackDirection;
  playbackMode: PlaybackMode;
  toneType: ToneType;
  progression: ChordDefinition[];
}

const STORAGE_KEY = 'circlesense:settings';

const VALID_DIRECTIONS: PlaybackDirection[] = ['clockwise', 'counter'];
const VALID_MODES: PlaybackMode[] = ['sequential', 'random'];
const VALID_TONES: ToneType[] = ['triangle', 'piano', 'warm-pad'];

/**
 * The progression to open with. A first-time visitor gets a ii–V–I in C so Start works
 * straight away. A returning player gets exactly what they saved, including an empty
 * progression they cleared on purpose.
 */
export function startingProgression(saved: Settings | null): ChordDefinition[] {
  return saved ? saved.progression : buildExercise(0, 'ii-v-i');
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function loadSettings(): Settings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const { bpm, barLength, direction, playbackMode, toneType, progression, target } = parsed;

    if (!Number.isFinite(bpm) || typeof bpm !== 'number' || bpm < 30 || bpm > 400) return null;
    if (![1, 2, 3, 4].includes(barLength)) return null;
    if (!VALID_DIRECTIONS.includes(direction)) return null;
    if (playbackMode != null && !VALID_MODES.includes(playbackMode)) return null;
    if (toneType != null && !VALID_TONES.includes(toneType)) return null;
    if (progression != null && !Array.isArray(progression)) return null;

    if (target != null && !['chord', 'third', 'guide'].includes(target)) return null;
    if (Array.isArray(progression) && !progression.every((chord) =>
      chord && typeof chord === 'object' && Object.hasOwn(NOTE_TO_PC, chord.root) &&
      NOTE_TO_PC[chord.root as keyof typeof NOTE_TO_PC] === chord.rootPitchClass &&
      ['major', 'minor', 'major7', 'minor7', 'dominant7'].includes(chord.quality) &&
      typeof chord.label === 'string' && chord.label.length <= 24
    )) return null;

    return {
      target: target ?? 'chord',
      bpm,
      barLength,
      direction,
      playbackMode: playbackMode ?? 'sequential',
      toneType: toneType ?? 'piano',
      progression: Array.isArray(progression) ? progression : [],
    };
  } catch {
    return null;
  }
}
