/**
 * The transport is a state machine. The two count-ins are separate states because they
 * mean different things: 'counting-in' starts a new take, 'counting-back' leads back
 * into a paused one.
 */
export type TransportState = 'stopped' | 'counting-in' | 'playing' | 'paused' | 'counting-back';

/** Every legal move. The conductor refuses anything else. */
export const TRANSPORT_TRANSITIONS: Record<TransportState, readonly TransportState[]> = {
  stopped: ['counting-in'],
  'counting-in': ['playing', 'paused', 'stopped'],
  playing: ['paused', 'stopped'],
  paused: ['counting-back', 'stopped'],
  'counting-back': ['playing', 'paused', 'stopped'],
};

export function canTransition(from: TransportState, to: TransportState): boolean {
  return TRANSPORT_TRANSITIONS[from].includes(to);
}

export function isCounting(state: TransportState): boolean {
  return state === 'counting-in' || state === 'counting-back';
}

/** The clock is advancing: counting or playing. */
export function isRunning(state: TransportState): boolean {
  return state === 'playing' || isCounting(state);
}

/**
 * What a transport state means for the take being practised. Playback and scoring both
 * follow this one definition instead of each interpreting transport states themselves.
 *  - new:  a fresh take is counting in; previous positions and results are replaced
 *  - live: chords are sounding and notes are scored
 *  - held: paused, or counting back in; position and results are kept
 *  - over: stopped; results stay for review, position returns to the start
 */
export type TakePhase = 'new' | 'live' | 'held' | 'over';

export function takePhase(state: TransportState): TakePhase {
  switch (state) {
    case 'counting-in': return 'new';
    case 'playing': return 'live';
    case 'paused':
    case 'counting-back': return 'held';
    case 'stopped': return 'over';
  }
}

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
}

export type ConductorEvent = BeatEvent | BarEvent | CycleEvent | TransportEvent;

export interface ConductorSnapshot {
  transport: TransportState;
  config: ConductorConfig;
  position: ConductorPosition;
  countInBeat: number;
}
