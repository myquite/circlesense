export type TransportState = 'stopped' | 'playing' | 'paused' | 'counting';

export interface ConductorConfig {
  bpm: number;
  beatsPerBar: number;
  barLength: 1 | 2 | 3 | 4;
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
  /** True when a count-in leads back into a paused session rather than starting a new one. */
  resuming?: boolean;
}

export type ConductorEvent = BeatEvent | BarEvent | CycleEvent | TransportEvent;

export interface ConductorSnapshot {
  transport: TransportState;
  config: ConductorConfig;
  position: ConductorPosition;
  countInBeat: number;
}
