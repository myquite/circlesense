import type { Conductor } from './conductor';
import type { BarEvent, TransportEvent } from './conductor.types';
import type { PlaybackEngineSnapshot, ActiveVoice, PlaybackDirection } from './playbackEngine.types';
import type { ChordQuality } from '../engine/chordData.types';
import { buildVoicing, getGMajorProgression } from '../engine/chordData';
import type { ProgressionDefinition } from '../engine/chordData.types';

const ATTACK_SEC = 0.01;
const RELEASE_SEC = 0.05;

export class PlaybackEngine {
  private conductor: Conductor;
  private ctx: AudioContext;
  private masterGain: GainNode;

  private progression: ProgressionDefinition;
  private chordIndex = 0;
  private chordQuality: ChordQuality = 'dom7';
  private direction: PlaybackDirection = 'clockwise';
  private barCounter = 0;
  private playing = false;

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

    this.progression = getGMajorProgression(this.chordQuality);
    this.currentSnapshot = this.buildSnapshot();

    this.unsubBar = conductor.on('bar', (e) => this.handleBar(e));
    this.unsubTransport = conductor.on('transport', (e) => this.handleTransport(e));
  }

  // --- Event handlers ---

  private handleBar(event: BarEvent): void {
    // Advance chord on cycle boundary (every barLength bars)
    // bar === 0 means we're at the start of a new cycle
    if (event.bar === 0) {
      this.barCounter = 0;
      this.scheduleNextChord(event.audioTime);
    } else {
      this.barCounter++;
    }
  }

  private handleTransport(event: TransportEvent): void {
    switch (event.state) {
      case 'playing':
        this.playing = true;
        this.chordIndex = 0;
        this.barCounter = 0;
        break;
      case 'paused':
        this.playing = false;
        this.fadeOutAllVoices();
        this.notifySnapshot();
        break;
      case 'stopped':
        this.playing = false;
        this.killAllVoices();
        this.chordIndex = 0;
        this.barCounter = 0;
        this.notifySnapshot();
        break;
    }
  }

  private scheduleNextChord(audioTime: number): void {
    const chord = this.progression.chords[this.chordIndex];
    const voicing = buildVoicing(chord.rootPitchClass, chord.quality);

    const { bpm, beatsPerBar, barLength } = this.conductor.getSnapshot().config;
    const secsPerBeat = 60 / bpm;
    const duration = beatsPerBar * barLength * secsPerBeat;

    this.scheduleChord(voicing.frequencies, audioTime, duration);

    // Advance index for next cycle
    const step = this.direction === 'clockwise' ? 1 : -1;
    const len = this.progression.chords.length;
    this.chordIndex = ((this.chordIndex + step) + len) % len;
    this.notifySnapshot();
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
      osc.stop(startTime + duration + 0.01); // tiny buffer past release

      voice.oscillators.push(osc);
      voice.gains.push(gain);
    }

    this.activeVoices.push(voice);

    // Clean up finished voices after they end
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

  setChordQuality(quality: ChordQuality): void {
    if (quality === this.chordQuality) return;
    this.chordQuality = quality;
    this.progression = getGMajorProgression(quality);
    this.chordIndex = 0;
    this.notifySnapshot();
  }

  setDirection(dir: PlaybackDirection): void {
    if (dir === this.direction) return;
    this.direction = dir;
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
    const chords = this.progression.chords;
    const len = chords.length;
    const step = this.direction === 'clockwise' ? 1 : -1;
    // currentChord is the one currently playing (the one we just scheduled)
    // Since chordIndex advances after scheduling, the current chord is at index - step
    const currentIdx = this.playing
      ? ((this.chordIndex - step) + len) % len
      : 0;
    const nextIdx = this.playing
      ? this.chordIndex
      : ((0 + step) + len) % len;

    return {
      currentChord: chords[currentIdx] ?? null,
      nextChord: chords[nextIdx] ?? null,
      chordIndex: currentIdx,
      chordQuality: this.chordQuality,
      isActive: this.playing,
      direction: this.direction,
      progressionLabels: chords.map((c) => c.label),
    };
  }

  private notifySnapshot(): void {
    this.currentSnapshot = this.buildSnapshot();
    for (const cb of this.snapshotListeners) {
      cb();
    }
  }
}
