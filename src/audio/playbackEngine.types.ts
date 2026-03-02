import type { ChordDefinition, ChordQuality } from '../engine/chordData.types';

export type PlaybackDirection = 'clockwise' | 'counter';

export interface PlaybackEngineSnapshot {
  currentChord: ChordDefinition | null;
  nextChord: ChordDefinition | null;
  chordIndex: number;
  chordQuality: ChordQuality;
  isActive: boolean;
  direction: PlaybackDirection;
  progressionLabels: string[];
}

export interface ActiveVoice {
  oscillators: OscillatorNode[];
  gains: GainNode[];
  stopTime: number;
}
