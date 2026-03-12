import type { ChordDefinition } from '../engine/chordData.types';

export type PlaybackDirection = 'clockwise' | 'counter';
export type PlaybackMode = 'sequential' | 'random';

export interface PlaybackEngineSnapshot {
  currentChord: ChordDefinition | null;
  nextChord: ChordDefinition | null;
  chordIndex: number;
  isActive: boolean;
  direction: PlaybackDirection;
  playbackMode: PlaybackMode;
  progression: ChordDefinition[];
}

export interface ActiveVoice {
  oscillators: OscillatorNode[];
  gains: GainNode[];
  stopTime: number;
}
