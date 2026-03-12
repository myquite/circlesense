import type { Conductor } from './conductor';
import type { BarEvent, TransportEvent } from './conductor.types';
import type { PlaybackEngineSnapshot, ActiveVoice, PlaybackDirection, PlaybackMode } from './playbackEngine.types';
import type { ChordDefinition } from '../engine/chordData.types';
import { buildVoicing } from '../engine/chordData';

const ATTACK_SEC = 0.01;
const RELEASE_SEC = 0.05;

export class PlaybackEngine {
  private conductor: Conductor;
  private ctx: AudioContext;
  private masterGain: GainNode;

  private progression: ChordDefinition[] = [];
  /** Index of the chord currently sounding */
  private playingIndex = 0;
  private direction: PlaybackDirection = 'clockwise';
  private playbackMode: PlaybackMode = 'sequential';
  private playing = false;
  private firstChordScheduled = false;

  private activeVoices: ActiveVoice[] = [];
  private unsubBar: (() => void) | null = null;
  private unsubTransport: (() => void) | null = null;

  private snapshotListeners = new Set<() => void>();
  private currentSnapshot: PlaybackEngineSnapshot;

  constructor(conductor: Conductor) {
    this.conductor = conductor;
    this.ctx = conductor.audioContext;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3;
    this.masterGain.connect(this.ctx.destination);

    this.currentSnapshot = this.buildSnapshot();

    this.unsubBar = conductor.on('bar', (e) => this.handleBar(e));
    this.unsubTransport = conductor.on('transport', (e) => this.handleTransport(e));
  }

  // --- Event handlers ---

  private handleBar(event: BarEvent): void {
    if (event.bar === 0 && this.progression.length > 0) {
      if (!this.firstChordScheduled) {
        // First chord of the session — play at playingIndex (0)
        this.firstChordScheduled = true;
        this.scheduleCurrentChord(event.audioTime);
      } else {
        // Advance to next chord, then schedule it
        this.advancePlayingIndex();
        this.scheduleCurrentChord(event.audioTime);
      }
    }
  }

  private handleTransport(event: TransportEvent): void {
    switch (event.state) {
      case 'playing':
        this.playing = true;
        this.playingIndex = 0;
        this.firstChordScheduled = false;
        this.notifySnapshot();
        break;
      case 'paused':
        this.playing = false;
        this.fadeOutAllVoices();
        this.notifySnapshot();
        break;
      case 'stopped':
        this.playing = false;
        this.killAllVoices();
        this.playingIndex = 0;
        this.firstChordScheduled = false;
        this.notifySnapshot();
        break;
    }
  }

  private scheduleCurrentChord(audioTime: number): void {
    if (this.progression.length === 0) return;

    const chord = this.progression[this.playingIndex];
    const voicing = buildVoicing(chord.rootPitchClass, chord.quality);

    const { bpm, beatsPerBar, barLength } = this.conductor.getSnapshot().config;
    const secsPerBeat = 60 / bpm;
    const duration = beatsPerBar * barLength * secsPerBeat;

    this.scheduleChord(voicing.frequencies, audioTime, duration);
    this.notifySnapshot();
  }

  private advancePlayingIndex(): void {
    const len = this.progression.length;
    if (len <= 1) return;

    if (this.playbackMode === 'random') {
      let next: number;
      do {
        next = Math.floor(Math.random() * len);
      } while (next === this.playingIndex);
      this.playingIndex = next;
    } else {
      const step = this.direction === 'clockwise' ? 1 : -1;
      this.playingIndex = ((this.playingIndex + step) + len) % len;
    }
  }

  private nextIndex(): number {
    const len = this.progression.length;
    if (len <= 1) return 0;

    if (this.playbackMode === 'random') {
      return this.playingIndex; // can't predict random
    }
    const step = this.direction === 'clockwise' ? 1 : -1;
    return ((this.playingIndex + step) + len) % len;
  }

  private scheduleChord(frequencies: number[], startTime: number, duration: number): void {
    const voice: ActiveVoice = {
      oscillators: [],
      gains: [],
      stopTime: startTime + duration,
    };

    for (const freq of frequencies) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(1, startTime + ATTACK_SEC);
      gain.gain.setValueAtTime(1, startTime + duration - RELEASE_SEC);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.01);

      voice.oscillators.push(osc);
      voice.gains.push(gain);
    }

    this.activeVoices.push(voice);

    setTimeout(() => {
      this.activeVoices = this.activeVoices.filter((v) => v !== voice);
    }, (voice.stopTime - this.ctx.currentTime) * 1000 + 100);
  }

  private fadeOutAllVoices(): void {
    const now = this.ctx.currentTime;
    for (const voice of this.activeVoices) {
      for (const gain of voice.gains) {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + RELEASE_SEC);
      }
      for (const osc of voice.oscillators) {
        osc.stop(now + RELEASE_SEC + 0.01);
      }
    }
    this.activeVoices = [];
  }

  private killAllVoices(): void {
    const now = this.ctx.currentTime;
    for (const voice of this.activeVoices) {
      for (const osc of voice.oscillators) {
        try { osc.stop(now); } catch { /* already stopped */ }
      }
    }
    this.activeVoices = [];
  }

  // --- Public API ---

  setProgression(chords: ChordDefinition[]): void {
    this.progression = [...chords];
    this.playingIndex = 0;
    this.firstChordScheduled = false;
    this.notifySnapshot();
  }

  addChord(chord: ChordDefinition): void {
    this.progression.push(chord);
    this.notifySnapshot();
  }

  removeChord(index: number): void {
    if (index < 0 || index >= this.progression.length) return;
    this.progression.splice(index, 1);
    if (this.playingIndex >= this.progression.length) {
      this.playingIndex = 0;
    }
    this.notifySnapshot();
  }

  clearProgression(): void {
    this.progression = [];
    this.playingIndex = 0;
    this.firstChordScheduled = false;
    this.notifySnapshot();
  }

  setDirection(dir: PlaybackDirection): void {
    if (dir === this.direction) return;
    this.direction = dir;
    this.notifySnapshot();
  }

  setPlaybackMode(mode: PlaybackMode): void {
    if (mode === this.playbackMode) return;
    this.playbackMode = mode;
    this.notifySnapshot();
  }

  // --- useSyncExternalStore support ---

  subscribe = (callback: () => void): (() => void) => {
    this.snapshotListeners.add(callback);
    return () => {
      this.snapshotListeners.delete(callback);
    };
  };

  getSnapshot = (): PlaybackEngineSnapshot => {
    return this.currentSnapshot;
  };

  dispose(): void {
    this.killAllVoices();
    this.unsubBar?.();
    this.unsubTransport?.();
    this.snapshotListeners.clear();
    this.masterGain.disconnect();
  }

  // --- Internal ---

  private buildSnapshot(): PlaybackEngineSnapshot {
    const len = this.progression.length;

    return {
      currentChord: len > 0 ? (this.progression[this.playingIndex] ?? null) : null,
      nextChord: len > 0 ? (this.progression[this.nextIndex()] ?? null) : null,
      chordIndex: this.playingIndex,
      isActive: this.playing,
      direction: this.direction,
      playbackMode: this.playbackMode,
      progression: [...this.progression],
    };
  }

  private notifySnapshot(): void {
    this.currentSnapshot = this.buildSnapshot();
    for (const cb of this.snapshotListeners) {
      cb();
    }
  }
}
