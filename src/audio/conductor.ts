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
const COUNT_IN_BEATS = 4;

const DEFAULT_CONFIG: ConductorConfig = {
  bpm: 120,
  beatsPerBar: 4,
  barLength: 1,
};

export class Conductor {
  private ctx: AudioContext;
  private transport: TransportState = 'stopped';
  private config: ConductorConfig = { ...DEFAULT_CONFIG };
  /** Scheduler position — may be ahead of what's audible */
  private position: ConductorPosition = { bar: 0, beat: 0, totalBars: 0 };
  /** Display position — updates when the beat actually sounds */
  private displayPosition: ConductorPosition = { bar: 0, beat: 0, totalBars: 0 };

  private countInRemaining = 0;
  private displayCountIn = 0;
  private nextBeatTime = 0;
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private displayTimers: ReturnType<typeof setTimeout>[] = [];
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
    if (this.transport === 'playing' || this.transport === 'counting') return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const wasStoppedOrFirst = this.transport === 'stopped';

    if (wasStoppedOrFirst) {
      // Start count-in
      this.transport = 'counting';
      this.countInRemaining = COUNT_IN_BEATS;
      this.displayCountIn = 0;
      this.position = { bar: 0, beat: 0, totalBars: 0 };
      this.displayPosition = { bar: 0, beat: 0, totalBars: 0 };
      this.nextBeatTime = this.ctx.currentTime + 0.05;
      this.startScheduler();
      this.notifySnapshot();
    } else {
      // Resuming from pause — no count-in
      this.transport = 'playing';
      this.nextBeatTime = this.ctx.currentTime + 0.05;
      this.startScheduler();
      this.emitTransport();
      this.notifySnapshot();
    }
  }

  pause(): void {
    if (this.transport !== 'playing' && this.transport !== 'counting') return;
    this.transport = 'paused';
    this.countInRemaining = 0;
    this.displayCountIn = 0;
    this.stopScheduler();
    this.clearDisplayTimers();
    this.emitTransport();
    this.notifySnapshot();
  }

  stop(): void {
    if (this.transport === 'stopped') return;
    this.transport = 'stopped';
    this.countInRemaining = 0;
    this.displayCountIn = 0;
    this.stopScheduler();
    this.clearDisplayTimers();
    this.position = { bar: 0, beat: 0, totalBars: 0 };
    this.displayPosition = { bar: 0, beat: 0, totalBars: 0 };
    this.emitTransport();
    this.notifySnapshot();
  }

  setBpm(bpm: number): void {
    const clamped = Math.max(30, Math.min(400, bpm));
    if (clamped === this.config.bpm) return;

    if (this.transport === 'playing' || this.transport === 'counting') {
      const oldSecsPerBeat = 60 / this.config.bpm;
      const newSecsPerBeat = 60 / clamped;
      const elapsed = this.ctx.currentTime - (this.nextBeatTime - oldSecsPerBeat);
      const fraction = Math.min(elapsed / oldSecsPerBeat, 1);
      this.nextBeatTime = this.ctx.currentTime + newSecsPerBeat * (1 - fraction);
    }

    this.config = { ...this.config, bpm: clamped };
    this.notifySnapshot();
  }

  setBarLength(barLength: 1 | 2 | 3 | 4): void {
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
    this.clearDisplayTimers();
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

  private clearDisplayTimers(): void {
    for (const t of this.displayTimers) {
      clearTimeout(t);
    }
    this.displayTimers = [];
  }

  /** Schedule a UI update to fire when a beat actually becomes audible */
  private scheduleDisplayUpdate(audioTime: number, update: () => void): void {
    const delayMs = Math.max(0, (audioTime - this.ctx.currentTime) * 1000);
    const timer = setTimeout(() => {
      update();
      this.notifySnapshot();
      this.displayTimers = this.displayTimers.filter((t) => t !== timer);
    }, delayMs);
    this.displayTimers.push(timer);
  }

  private schedulerTick(): void {
    const deadline = this.ctx.currentTime + LOOKAHEAD_SEC;
    const secsPerBeat = 60 / this.config.bpm;

    while (this.nextBeatTime < deadline) {
      const audioTime = this.nextBeatTime;

      if (this.transport === 'counting') {
        // Count-in phase: tick beats but don't emit bar/cycle events
        this.scheduleClick(audioTime);
        const beatNum = COUNT_IN_BEATS - this.countInRemaining + 1;
        this.countInRemaining--;

        // Schedule display update for when this count-in beat sounds
        this.scheduleDisplayUpdate(audioTime, () => {
          this.displayCountIn = beatNum;
        });

        if (this.countInRemaining <= 0) {
          // Count-in done — transition to playing
          this.transport = 'playing';
          this.position = { bar: 0, beat: 0, totalBars: 0 };
          this.emitTransport();
          this.nextBeatTime = audioTime + secsPerBeat;
          break;
        }

        this.nextBeatTime = audioTime + secsPerBeat;
        continue;
      }

      // Normal playback
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

      // Schedule display update for when this beat actually sounds
      const displayPos = { ...this.position };
      this.scheduleDisplayUpdate(audioTime, () => {
        this.displayPosition = displayPos;
      });

      // Advance scheduler position
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
  }

  private scheduleClick(audioTime: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 1000;

    gain.gain.setValueAtTime(0.3, audioTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(audioTime);
    osc.stop(audioTime + 0.1);
  }

  // --- Helpers ---

  private buildSnapshot(): ConductorSnapshot {
    return {
      transport: this.transport,
      config: { ...this.config },
      position: { ...this.displayPosition },
      countInBeat: this.displayCountIn,
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
