import type { ChordDefinition } from '../engine/chordData.types';
import type { PlaybackDirection, PlaybackMode, ToneType } from '../audio/playbackEngine.types';

export interface Settings {
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

    const { bpm, barLength, direction, playbackMode, toneType, progression } = parsed;

    if (typeof bpm !== 'number' || bpm < 30 || bpm > 400) return null;
    if (![1, 2, 3, 4].includes(barLength)) return null;
    if (!VALID_DIRECTIONS.includes(direction)) return null;
    if (playbackMode && !VALID_MODES.includes(playbackMode)) return null;
    if (toneType && !VALID_TONES.includes(toneType)) return null;
    if (progression && !Array.isArray(progression)) return null;

    return {
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
