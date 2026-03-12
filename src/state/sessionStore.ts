import type { ChordDefinition } from '../engine/chordData.types';
import type { PlaybackDirection, PlaybackMode } from '../audio/playbackEngine.types';

export interface Settings {
  bpm: number;
  barLength: 1 | 2 | 3 | 4;
  direction: PlaybackDirection;
  playbackMode: PlaybackMode;
  progression: ChordDefinition[];
}

const STORAGE_KEY = 'circlesense:settings';

const VALID_DIRECTIONS: PlaybackDirection[] = ['clockwise', 'counter'];
const VALID_MODES: PlaybackMode[] = ['sequential', 'random'];

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

    const { bpm, barLength, direction, playbackMode, progression } = parsed;

    if (typeof bpm !== 'number' || bpm < 30 || bpm > 400) return null;
    if (![1, 2, 3, 4].includes(barLength)) return null;
    if (!VALID_DIRECTIONS.includes(direction)) return null;
    if (playbackMode && !VALID_MODES.includes(playbackMode)) return null;
    if (progression && !Array.isArray(progression)) return null;

    return {
      bpm,
      barLength,
      direction,
      playbackMode: playbackMode ?? 'sequential',
      progression: Array.isArray(progression) ? progression : [],
    };
  } catch {
    return null;
  }
}
