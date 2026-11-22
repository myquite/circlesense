import type {
  TransportState,
  ConductorConfig,
  ConductorPosition,
  ConductorSnapshot,
  ConductorEvent,
  TransportEvent,
} from './conductor.types';
import { setAudioSession } from './audioSession';

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

  private barTimeline: { audioTime: number; id: number }[] = [];
  private barSerial = 0;
  private clicks = new Set<OscillatorNode>();
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
    setAudioSession('playback');
    // Opening or closing the microphone can interrupt output on iOS. If that happens
    // mid-take, pick the audio back up rather than leaving the transport running silently.
    this.ctx.addEventListener?.('statechange', () => {
      if (this.transport === 'playing' || this.transport === 'counting') this.ensureRunning();
    });
    this.currentSnapshot = this.buildSnapshot();
  }

  get audioContext(): AudioContext {
    return this.ctx;
  }

  /**
   * Wake the audio output if the browser has parked it. Not just 'suspended': iOS reports
   * 'interrupted' after a call, Siri, another app, or an audio-route change.
   * Safe to call from any user gesture.
   */
  ensureRunning(): void {
    if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {});
  }

  // --- Transport controls ---

  play(): void {
    if (this.transport === 'playing' || this.transport === 'counting') return;

    this.ensureRunning();

    const wasStoppedOrFirst = this.transport === 'stopped';

    if (wasStoppedOrFirst) {
      this.barTimeline = [];
      this.barSerial = 0;
      // Start count-in
      this.transport = 'counting';
      this.emitTransport();
      this.countInRemaining = COUNT_IN_BEATS;
      this.displayCountIn = 0;
      this.position = { bar: 0, beat: 0, totalBars: 0 };
      this.displayPosition = { bar: 0, beat: 0, totalBars: 0 };
      this.nextBeatTime = this.ctx.currentTime + 0.05;
      this.startScheduler();
      this.notifySnapshot();
    } else {
      // Resume at the start of the current chord, retaining the session.
      // A count-in gives the player time to get back to the instrument.
      this.position = { ...this.displayPosition, bar: 0, beat: 0 };
      this.transport = 'counting';
      this.emitTransport(true);
      this.countInRemaining = COUNT_IN_BEATS;
      this.displayCountIn = 0;
      this.nextBeatTime = this.ctx.currentTime + 0.05;
      this.startScheduler();
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
    this.stopClicks();
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
    this.stopClicks();
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

  getCurrentBarId(): number {
    return this.barTimeline.filter((bar) => bar.audioTime <= this.ctx.currentTime).at(-1)?.id ?? 0;
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
    this.stopClicks();
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
  scheduleDisplayUpdate(audioTime: number, update: () => void): void {
    const delayMs = Math.max(0, (audioTime - this.ctx.currentTime) * 1000);
    const timer = setTimeout(() => {
      this.displayTimers = this.displayTimers.filter((t) => t !== timer);
      // Timers can fire early or while AudioContext is suspended.
      if (this.ctx.currentTime + 0.000001 < audioTime) {
        this.scheduleDisplayUpdate(audioTime, update);
        return;
      }
      update();
      this.notifySnapshot();
    }, Math.max(1, delayMs));
    this.displayTimers.push(timer);
  }

  private schedulerTick(): void {
    const deadline = this.ctx.currentTime + LOOKAHEAD_SEC;
    const secsPerBeat = 60 / this.config.bpm;

    while (this.nextBeatTime < deadline) {
      const audioTime = this.nextBeatTime;

      if (this.transport === 'counting' && this.countInRemaining > 0) {
        // Count-in phase: tick beats but don't emit bar/cycle events
        this.scheduleClick(audioTime);
        const beatNum = COUNT_IN_BEATS - this.countInRemaining + 1;
        this.countInRemaining--;

        // Schedule display update for when this count-in beat sounds
        this.scheduleDisplayUpdate(audioTime, () => {
          this.displayCountIn = beatNum;
        });

        if (this.countInRemaining <= 0) {
          // Schedule playback after the final count-in beat, from the position play() chose.
          this.nextBeatTime = audioTime + secsPerBeat;
          break;
        }

        this.nextBeatTime = audioTime + secsPerBeat;
        continue;
      }

      if (this.transport === 'counting') {
        this.transport = 'playing';
        this.emitTransport();
      }

      // Normal playback
      const { beat, bar } = this.position;
      const { beatsPerBar, barLength } = this.config;

      // Emit beat event
      this.emit('beat', { type: 'beat', audioTime, bar, beat });

      // Emit bar event on beat 0
      if (beat === 0) {
        this.barTimeline.push({ audioTime, id: ++this.barSerial });
        this.barTimeline = this.barTimeline.slice(-4);
        this.emit('bar', { type: 'bar', audioTime, bar });
      }

      // Emit cycle event on bar 0, beat 0
      if (beat === 0 && bar === 0) {
        this.emit('cycle', { type: 'cycle', audioTime });
      }

      // Schedule display update for when this beat actually sounds
      const displayPos = { ...this.position };
      this.scheduleDisplayUpdate(audioTime, () => {
        this.displayCountIn = 0;
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

  private stopClicks(): void {
    for (const click of this.clicks) { try { click.stop(); } catch { /* already ended */ } }
    this.clicks.clear();
  }

  private scheduleClick(audioTime: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    this.clicks.add(osc);
    osc.onended = () => { this.clicks.delete(osc); osc.disconnect(); gain.disconnect(); };
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
      transport: this.transport === 'playing' && this.displayCountIn > 0 ? 'counting' : this.transport,
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

  private emitTransport(resuming = false): void {
    const event: TransportEvent = {
      type: 'transport',
      state: this.transport,
      audioTime: this.ctx.currentTime,
      resuming,
    };
    this.emit('transport', event);
  }
}
