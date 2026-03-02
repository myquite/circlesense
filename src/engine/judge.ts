import type { Conductor } from '../audio/conductor';
import type { PlaybackEngine } from '../audio/playbackEngine';
import type { BarEvent, TransportEvent } from '../audio/conductor.types';
import type { PitchClass } from './chordData.types';
import type { JudgeSnapshot, OutOfScaleEntry } from './judge.types';
import { buildVoicing, NOTE_TO_PC } from './chordData';
import { getMajorScale, PC_TO_NOTE_NAME } from './scaleData';

const EMPTY_SNAPSHOT: JudgeSnapshot = {
  lastDetectedNote: null,
  lastDetectedName: null,
  isInChord: false,
  isInScale: false,
  currentBarAccuracy: 0,
  currentBarTotal: 0,
  sessionAccuracy: 0,
  sessionTotal: 0,
  outOfScaleLog: [],
  isActive: false,
};

export class Judge {
  private playbackEngine: PlaybackEngine;

  // Bar-level counters
  private barHits = 0;
  private barTotal = 0;

  // Session-level counters
  private sessionHits = 0;
  private sessionTotal = 0;

  // Out-of-scale tracking
  private outOfScaleMap = new Map<PitchClass, number>();

  // Last note state
  private lastDetectedNote: PitchClass | null = null;
  private lastDetectedName: string | null = null;
  private lastIsInChord = false;
  private lastIsInScale = false;

  private active = false;

  private unsubBar: (() => void) | null = null;
  private unsubTransport: (() => void) | null = null;

  private snapshotListeners = new Set<() => void>();
  private currentSnapshot: JudgeSnapshot = EMPTY_SNAPSHOT;

  constructor(conductor: Conductor, playbackEngine: PlaybackEngine) {
    this.playbackEngine = playbackEngine;

    this.unsubBar = conductor.on('bar', (e) => this.handleBar(e));
    this.unsubTransport = conductor.on('transport', (e) => this.handleTransport(e));
  }

  // --- Public API ---

  submitNote(pitchClass: PitchClass): void {
    if (!this.active) return;

    const snapshot = this.playbackEngine.getSnapshot();
    if (!snapshot.currentChord) return;

    const voicing = buildVoicing(
      snapshot.currentChord.rootPitchClass,
      snapshot.currentChord.quality,
    );

    const inChord = voicing.pitchClasses.includes(pitchClass);
    const scale = getMajorScale(NOTE_TO_PC[snapshot.key]);
    const inScale = scale.has(pitchClass);

    // Update bar counters
    this.barTotal++;
    if (inChord) this.barHits++;

    // Update session counters
    this.sessionTotal++;
    if (inChord) this.sessionHits++;

    // Track out-of-scale notes
    if (!inScale) {
      const prev = this.outOfScaleMap.get(pitchClass) ?? 0;
      this.outOfScaleMap.set(pitchClass, prev + 1);
    }

    // Update last note state
    this.lastDetectedNote = pitchClass;
    this.lastDetectedName = PC_TO_NOTE_NAME[pitchClass];
    this.lastIsInChord = inChord;
    this.lastIsInScale = inScale;

    this.notifySnapshot();
  }

  resetSession(): void {
    this.barHits = 0;
    this.barTotal = 0;
    this.sessionHits = 0;
    this.sessionTotal = 0;
    this.outOfScaleMap.clear();
    this.lastDetectedNote = null;
    this.lastDetectedName = null;
    this.lastIsInChord = false;
    this.lastIsInScale = false;
    this.notifySnapshot();
  }

  // --- Event handlers ---

  private handleBar(event: BarEvent): void {
    // On cycle boundary (bar === 0), finalize bar stats and reset bar counters
    if (event.bar === 0 && this.active) {
      // Reset bar counters for the new bar
      this.barHits = 0;
      this.barTotal = 0;
      this.notifySnapshot();
    }
  }

  private handleTransport(event: TransportEvent): void {
    switch (event.state) {
      case 'playing':
        this.active = true;
        this.resetSession();
        break;
      case 'stopped':
        this.active = false;
        this.resetSession();
        break;
      case 'paused':
        // Keep current state, just mark inactive
        this.active = false;
        this.notifySnapshot();
        break;
    }
  }

  // --- useSyncExternalStore support ---

  subscribe = (callback: () => void): (() => void) => {
    this.snapshotListeners.add(callback);
    return () => {
      this.snapshotListeners.delete(callback);
    };
  };

  getSnapshot = (): JudgeSnapshot => {
    return this.currentSnapshot;
  };

  dispose(): void {
    this.unsubBar?.();
    this.unsubTransport?.();
    this.snapshotListeners.clear();
  }

  // --- Internal ---

  private buildOutOfScaleLog(): OutOfScaleEntry[] {
    const entries: OutOfScaleEntry[] = [];
    for (const [pc, count] of this.outOfScaleMap) {
      entries.push({
        pitchClass: pc,
        noteName: PC_TO_NOTE_NAME[pc],
        count,
      });
    }
    entries.sort((a, b) => b.count - a.count);
    return entries;
  }

  private buildSnapshot(): JudgeSnapshot {
    const currentBarAccuracy =
      this.barTotal > 0 ? Math.round((this.barHits / this.barTotal) * 100) : 0;
    const sessionAccuracy =
      this.sessionTotal > 0
        ? Math.round((this.sessionHits / this.sessionTotal) * 100)
        : 0;

    return {
      lastDetectedNote: this.lastDetectedNote,
      lastDetectedName: this.lastDetectedName,
      isInChord: this.lastIsInChord,
      isInScale: this.lastIsInScale,
      currentBarAccuracy,
      currentBarTotal: this.barTotal,
      sessionAccuracy,
      sessionTotal: this.sessionTotal,
      outOfScaleLog: this.buildOutOfScaleLog(),
      isActive: this.active,
    };
  }

  private notifySnapshot(): void {
    this.currentSnapshot = this.buildSnapshot();
    for (const cb of this.snapshotListeners) {
      cb();
    }
  }
}
