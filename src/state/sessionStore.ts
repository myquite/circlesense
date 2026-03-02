import type { ChordQuality } from '../engine/chordData.types';
import type { PlaybackDirection } from '../audio/playbackEngine.types';

export interface Settings {
  bpm: number;
  barLength: 1 | 2;
  chordQuality: ChordQuality;
  direction: PlaybackDirection;
}

const STORAGE_KEY = 'circlesense:settings';

const VALID_QUALITIES: ChordQuality[] = ['maj7', 'dom7', 'min7', 'dim'];
const VALID_DIRECTIONS: PlaybackDirection[] = ['clockwise', 'counter'];

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

    const { bpm, barLength, chordQuality, direction } = parsed;

    if (typeof bpm !== 'number' || bpm < 30 || bpm > 400) return null;
    if (barLength !== 1 && barLength !== 2) return null;
    if (!VALID_QUALITIES.includes(chordQuality)) return null;
    if (!VALID_DIRECTIONS.includes(direction)) return null;

    return { bpm, barLength, chordQuality, direction };
  } catch {
    return null;
  }
}
