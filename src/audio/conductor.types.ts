export type TransportState = 'stopped' | 'playing' | 'paused';

export interface ConductorConfig {
  bpm: number;
  beatsPerBar: number;
  barLength: 1 | 2;
}

export interface ConductorPosition {
  bar: number;
  beat: number;
  totalBars: number;
}

export interface BeatEvent {
  type: 'beat';
  audioTime: number;
  bar: number;
  beat: number;
}

export interface BarEvent {
  type: 'bar';
  audioTime: number;
  bar: number;
}

export interface CycleEvent {
  type: 'cycle';
  audioTime: number;
}

export interface TransportEvent {
  type: 'transport';
  state: TransportState;
  audioTime: number;
}

export type ConductorEvent = BeatEvent | BarEvent | CycleEvent | TransportEvent;

export interface ConductorSnapshot {
  transport: TransportState;
  config: ConductorConfig;
  position: ConductorPosition;
}
