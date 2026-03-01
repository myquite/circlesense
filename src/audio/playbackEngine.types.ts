import type { ChordDefinition, ChordQuality } from '../engine/chordData.types';

export interface PlaybackEngineSnapshot {
  currentChord: ChordDefinition | null;
  nextChord: ChordDefinition | null;
  chordIndex: number;
  chordQuality: ChordQuality;
  isActive: boolean;
}

export interface ActiveVoice {
  oscillators: OscillatorNode[];
  gains: GainNode[];
  stopTime: number;
}
