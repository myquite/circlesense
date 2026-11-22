import type { Conductor } from '../audio/conductor';
import type { PlaybackEngine } from '../audio/playbackEngine';
import type { TransportEvent } from '../audio/conductor.types';
import type { PitchClass } from './chordData.types';
import type { JudgeSnapshot, OutsideTargetEntry, PracticeTarget, TakeSummary } from './judge.types';
import { buildVoicing, spellPitchClass } from './chordData';

const EMPTY_SNAPSHOT: JudgeSnapshot = {
  target: 'chord',
  lastDetectedNote: null,
  lastDetectedName: null,
  isTargetHit: false,
  currentBarAccuracy: 0,
  currentBarTotal: 0,
  sessionAccuracy: 0,
  sessionTotal: 0,
  outsideTargetLog: [],
  isActive: false,
  previousTake: null,
};

export class Judge {
  private conductor: Conductor;
  private lastBarId = 0;
  private playbackEngine: PlaybackEngine;

  // Bar-level counters
  private barHits = 0;
  private barTotal = 0;

  // Session-level counters
  private sessionHits = 0;
  private sessionTotal = 0;

  // Outside-target tracking
  /** Keyed by chord label and pitch class, so each entry says what the note was played over. */
  private outsideTargetMap = new Map<string, OutsideTargetEntry>();

  // Last note state
  private lastDetectedNote: PitchClass | null = null;
  private lastDetectedName: string | null = null;
  private lastIsTargetHit = false;

  private noteTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private target: PracticeTarget = 'chord';
  private previousTake: TakeSummary | null = null;

  private unsubBar: (() => void) | null = null;
  private unsubTransport: (() => void) | null = null;

  private snapshotListeners = new Set<() => void>();
  private currentSnapshot: JudgeSnapshot = EMPTY_SNAPSHOT;

  constructor(conductor: Conductor, playbackEngine: PlaybackEngine) {
    this.playbackEngine = playbackEngine;
    this.conductor = conductor;

    this.unsubBar = conductor.on('bar', (e) => conductor.scheduleDisplayUpdate(e.audioTime, () => this.syncBar()));
    this.unsubTransport = conductor.on('transport', (e) => this.handleTransport(e));
  }

  // --- Public API ---

  submitNote(pitchClass: PitchClass): void {
    if (!this.active) return;

    const chord = this.playbackEngine.getCurrentChord();
    if (!chord) return;
    this.syncBar();

    const voicing = buildVoicing(
      chord.rootPitchClass,
      chord.quality,
    );

    const targets = this.target === 'third' ? voicing.pitchClasses.slice(1, 2)
      : this.target === 'guide' ? [voicing.pitchClasses[1], voicing.pitchClasses[3]].filter((pc) => pc !== undefined)
      : voicing.pitchClasses;
    const targetHit = targets.includes(pitchClass);

    // Update bar counters
    this.barTotal++;
    if (targetHit) this.barHits++;

    // Update session counters
    this.sessionTotal++;
    if (targetHit) this.sessionHits++;

    // Track outside-target notes
    if (!targetHit) {
      const key = `${chord.label}|${pitchClass}`;
      const entry = this.outsideTargetMap.get(key);
      this.outsideTargetMap.set(key, {
        pitchClass,
        noteName: spellPitchClass(pitchClass, chord),
        chordLabel: chord.label,
        count: (entry?.count ?? 0) + 1,
      });
    }

    if (this.noteTimer) clearTimeout(this.noteTimer);
    this.noteTimer = setTimeout(() => {
      this.lastDetectedNote = null;
      this.lastDetectedName = null;
      this.notifySnapshot();
    }, 1500);

    // Update last note state
    this.lastDetectedNote = pitchClass;
    this.lastDetectedName = spellPitchClass(pitchClass, chord);
    this.lastIsTargetHit = targetHit;

    this.notifySnapshot();
  }

  setTarget(target: PracticeTarget): void {
    if (target === this.target) return;
    this.resetSession(); // archives the take under the target it was played with
    this.target = target;
    this.notifySnapshot();
  }

  /** Start a new take. A take with notes stays available as `previousTake` for comparison. */
  resetSession(): void {
    if (this.sessionTotal > 0) {
      this.previousTake = {
        target: this.target,
        accuracy: Math.round((this.sessionHits / this.sessionTotal) * 100),
        total: this.sessionTotal,
      };
    }
    this.clearCounters();
  }

  /** Discard the current take and the previous-take summary. */
  clearResults(): void {
    this.previousTake = null;
    this.clearCounters();
  }

  private clearCounters(): void {
    if (this.noteTimer) clearTimeout(this.noteTimer);
    this.barHits = 0;
    this.barTotal = 0;
    this.sessionHits = 0;
    this.sessionTotal = 0;
    this.outsideTargetMap.clear();
    this.lastDetectedNote = null;
    this.lastDetectedName = null;
    this.lastIsTargetHit = false;
    this.notifySnapshot();
  }

  // --- Event handlers ---

  private syncBar(): void {
    const id = this.conductor.getCurrentBarId();
    if (id === this.lastBarId) return;
    this.lastBarId = id;
    this.barHits = 0;
    this.barTotal = 0;
    this.lastDetectedNote = null;
    this.lastDetectedName = null;
    this.notifySnapshot();
  }

  private handleTransport(event: TransportEvent): void {
    switch (event.state) {
      case 'counting':
        if (event.resuming) break; // count-in back into a paused take: stay inactive, keep results
        this.active = false;
        this.lastBarId = 0;
        this.resetSession();
        break;
      case 'playing':
        this.active = true;
        this.notifySnapshot();
        break;
      case 'stopped':
        this.active = false;
        this.notifySnapshot();
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
    if (this.noteTimer) clearTimeout(this.noteTimer);
    this.unsubBar?.();
    this.unsubTransport?.();
    this.snapshotListeners.clear();
  }

  // --- Internal ---

  private buildOutsideTargetLog(): OutsideTargetEntry[] {
    const entries = [...this.outsideTargetMap.values()];
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
      target: this.target,
      lastDetectedNote: this.lastDetectedNote,
      lastDetectedName: this.lastDetectedName,
      isTargetHit: this.lastIsTargetHit,
      currentBarAccuracy,
      currentBarTotal: this.barTotal,
      sessionAccuracy,
      sessionTotal: this.sessionTotal,
      outsideTargetLog: this.buildOutsideTargetLog(),
      isActive: this.active,
      previousTake: this.previousTake,
    };
  }

  private notifySnapshot(): void {
    this.currentSnapshot = this.buildSnapshot();
    for (const cb of this.snapshotListeners) {
      cb();
    }
  }
}
