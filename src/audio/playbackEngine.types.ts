import type { ChordDefinition } from '../engine/chordData.types';

export type PlaybackDirection = 'clockwise' | 'counter';
export type PlaybackMode = 'sequential' | 'random';
export type ToneType = 'triangle' | 'piano' | 'warm-pad';

export const TONE_TYPES: { value: ToneType; label: string }[] = [
  { value: 'triangle', label: 'Triangle' },
  { value: 'piano', label: 'Piano' },
  { value: 'warm-pad', label: 'Warm Pad' },
];

export interface PlaybackEngineSnapshot {
  currentChord: ChordDefinition | null;
  nextChord: ChordDefinition | null;
  chordIndex: number;
  isActive: boolean;
  direction: PlaybackDirection;
  playbackMode: PlaybackMode;
  toneType: ToneType;
  progression: ChordDefinition[];
}

export interface ActiveVoice {
  nodes: AudioNode[];
  stopTime: number;
}
