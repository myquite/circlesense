import type {
  TransportState,
  ConductorConfig,
  ConductorPosition,
  ConductorSnapshot,
  ConductorEvent,
  TransportEvent,
} from './conductor.types';

type EventType = ConductorEvent['type'];
type EventOfType<T extends EventType> = Extract<ConductorEvent, { type: T }>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (event: any) => void;

const LOOKAHEAD_SEC = 0.1;
const SCHEDULER_INTERVAL_MS = 25;

const DEFAULT_CONFIG: ConductorConfig = {
  bpm: 120,
  beatsPerBar: 4,
  barLength: 1,
};

export class Conductor {
  private ctx: AudioContext;
  private transport: TransportState = 'stopped';
  private config: ConductorConfig = { ...DEFAULT_CONFIG };
  private position: ConductorPosition = { bar: 0, beat: 0, totalBars: 0 };

  private nextBeatTime = 0;
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Map<EventType, Set<Listener>>();
  private snapshotListeners = new Set<() => void>();
  private currentSnapshot: ConductorSnapshot;

  constructor() {
    this.ctx = new AudioContext();
    this.currentSnapshot = this.buildSnapshot();
  }

  get audioContext(): AudioContext {
    return this.ctx;
  }

  // --- Transport controls ---

  play(): void {
    if (this.transport === 'playing') return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const wasStoppedOrFirst = this.transport === 'stopped';
    this.transport = 'playing';

    if (wasStoppedOrFirst) {
      this.position = { bar: 0, beat: 0, totalBars: 0 };
      this.nextBeatTime = this.ctx.currentTime + 0.05;
    } else {
      // Resuming from pause — schedule next beat shortly from now
      this.nextBeatTime = this.ctx.currentTime + 0.05;
    }

    this.startScheduler();
    this.emitTransport();
    this.notifySnapshot();
  }

  pause(): void {
    if (this.transport !== 'playing') return;
    this.transport = 'paused';
    this.stopScheduler();
    this.emitTransport();
    this.notifySnapshot();
  }

  stop(): void {
    if (this.transport === 'stopped') return;
    this.transport = 'stopped';
    this.stopScheduler();
    this.position = { bar: 0, beat: 0, totalBars: 0 };
    this.emitTransport();
    this.notifySnapshot();
  }

  setBpm(bpm: number): void {
    const clamped = Math.max(30, Math.min(400, bpm));
    if (clamped === this.config.bpm) return;

    if (this.transport === 'playing') {
      const oldSecsPerBeat = 60 / this.config.bpm;
      const newSecsPerBeat = 60 / clamped;
      const elapsed = this.ctx.currentTime - (this.nextBeatTime - oldSecsPerBeat);
      const fraction = Math.min(elapsed / oldSecsPerBeat, 1);
      this.nextBeatTime = this.ctx.currentTime + newSecsPerBeat * (1 - fraction);
    }

    this.config = { ...this.config, bpm: clamped };
    this.notifySnapshot();
  }

  setBarLength(barLength: 1 | 2): void {
    if (barLength === this.config.barLength) return;
    this.config = { ...this.config, barLength };
    this.notifySnapshot();
  }

  // --- Event subscription ---

  on<T extends EventType>(type: T, listener: (event: EventOfType<T>) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    const set = this.listeners.get(type)!;
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  // --- useSyncExternalStore support ---

  subscribe = (callback: () => void): (() => void) => {
    this.snapshotListeners.add(callback);
    return () => {
      this.snapshotListeners.delete(callback);
    };
  };

  getSnapshot = (): ConductorSnapshot => {
    return this.currentSnapshot;
  };

  // --- Cleanup ---

  dispose(): void {
    this.stopScheduler();
    this.listeners.clear();
    this.snapshotListeners.clear();
    this.ctx.close();
  }

  // --- Internal scheduler ---

  private startScheduler(): void {
    if (this.schedulerTimer !== null) return;
    this.schedulerTimer = setInterval(() => this.schedulerTick(), SCHEDULER_INTERVAL_MS);
  }

  private stopScheduler(): void {
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private schedulerTick(): void {
    const deadline = this.ctx.currentTime + LOOKAHEAD_SEC;
    const secsPerBeat = 60 / this.config.bpm;

    while (this.nextBeatTime < deadline) {
      const audioTime = this.nextBeatTime;
      const { beat, bar } = this.position;
      const { beatsPerBar, barLength } = this.config;

      // Emit beat event
      this.emit('beat', { type: 'beat', audioTime, bar, beat });

      // Emit bar event on beat 0
      if (beat === 0) {
        this.emit('bar', { type: 'bar', audioTime, bar });
      }

      // Emit cycle event on bar 0, beat 0
      if (beat === 0 && bar === 0) {
        this.emit('cycle', { type: 'cycle', audioTime });
      }

      // Advance position
      const nextBeat = beat + 1;
      if (nextBeat >= beatsPerBar) {
        const nextBar = bar + 1;
        if (nextBar >= barLength) {
          this.position = { bar: 0, beat: 0, totalBars: this.position.totalBars + 1 };
        } else {
          this.position = { bar: nextBar, beat: 0, totalBars: this.position.totalBars };
        }
      } else {
        this.position = { ...this.position, beat: nextBeat };
      }

      this.nextBeatTime = audioTime + secsPerBeat;
    }

    this.notifySnapshot();
  }

  // --- Helpers ---

  private buildSnapshot(): ConductorSnapshot {
    return {
      transport: this.transport,
      config: { ...this.config },
      position: { ...this.position },
    };
  }

  private notifySnapshot(): void {
    this.currentSnapshot = this.buildSnapshot();
    for (const cb of this.snapshotListeners) {
      cb();
    }
  }

  private emit(type: EventType, event: ConductorEvent): void {
    const set = this.listeners.get(type);
    if (set) {
      for (const listener of set) {
        listener(event);
      }
    }
  }

  private emitTransport(): void {
    const event: TransportEvent = {
      type: 'transport',
      state: this.transport,
      audioTime: this.ctx.currentTime,
    };
    this.emit('transport', event);
  }
}
