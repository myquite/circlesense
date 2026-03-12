import type { Conductor } from './conductor';
import type { BarEvent, TransportEvent } from './conductor.types';
import type { PlaybackEngineSnapshot, ActiveVoice, PlaybackDirection, PlaybackMode, ToneType } from './playbackEngine.types';
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
  private toneType: ToneType = 'piano';
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
        this.firstChordScheduled = true;
        this.scheduleCurrentChord(event.audioTime);
      } else {
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

  // --- Tone Synthesis ---

  private scheduleChord(frequencies: number[], startTime: number, duration: number): void {
    switch (this.toneType) {
      case 'piano':
        this.schedulePianoChord(frequencies, startTime, duration);
        break;
      case 'warm-pad':
        this.scheduleWarmPadChord(frequencies, startTime, duration);
        break;
      default:
        this.scheduleTriangleChord(frequencies, startTime, duration);
        break;
    }
  }

  /** Clean triangle wave — simple, mellow, sustained */
  private scheduleTriangleChord(frequencies: number[], startTime: number, duration: number): void {
    const voice: ActiveVoice = { nodes: [], stopTime: startTime + duration };
    const noteGain = 0.8 / frequencies.length;

    for (const freq of frequencies) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(noteGain, startTime + ATTACK_SEC);
      gain.gain.setValueAtTime(noteGain, startTime + duration - RELEASE_SEC);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.01);

      voice.nodes.push(osc, gain);
    }

    this.trackVoice(voice);
  }

  /**
   * Piano-like tone using FM synthesis + harmonics with percussive decay.
   * Sharp hammer attack, rapid decay to a quiet sustain, then release.
   */
  private schedulePianoChord(frequencies: number[], startTime: number, duration: number): void {
    const voice: ActiveVoice = { nodes: [], stopTime: startTime + duration };
    const noteGain = 1.0 / frequencies.length;

    for (const freq of frequencies) {
      // Per-note output envelope (percussive: fast attack, exponential decay)
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0, startTime);
      env.gain.linearRampToValueAtTime(noteGain, startTime + 0.003);
      // Decay to 15% over ~0.8s (piano-like sustain drop)
      env.gain.setTargetAtTime(noteGain * 0.15, startTime + 0.003, 0.3);
      // Final release
      env.gain.setTargetAtTime(0.0001, startTime + duration - 0.05, 0.03);
      env.connect(this.masterGain);

      // FM modulator for the "hammer" brightness at attack
      const mod = this.ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.value = freq * 2; // modulator at 2x carrier
      const modGain = this.ctx.createGain();
      // High modulation index at attack, decays quickly = bright then mellow
      modGain.gain.setValueAtTime(freq * 1.5, startTime);
      modGain.gain.setTargetAtTime(0, startTime + 0.01, 0.08);
      mod.connect(modGain);

      // Carrier oscillator
      const carrier = this.ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.value = freq;
      modGain.connect(carrier.frequency); // FM connection

      carrier.connect(env);

      // Add a quiet second harmonic for body
      const harm2 = this.ctx.createOscillator();
      harm2.type = 'sine';
      harm2.frequency.value = freq * 2;
      const harm2Gain = this.ctx.createGain();
      harm2Gain.gain.setValueAtTime(0.3, startTime);
      harm2Gain.gain.setTargetAtTime(0.02, startTime + 0.01, 0.15);
      harm2.connect(harm2Gain);
      harm2Gain.connect(env);

      // Third harmonic — very quiet, adds shimmer
      const harm3 = this.ctx.createOscillator();
      harm3.type = 'sine';
      harm3.frequency.value = freq * 3;
      const harm3Gain = this.ctx.createGain();
      harm3Gain.gain.setValueAtTime(0.15, startTime);
      harm3Gain.gain.setTargetAtTime(0.0, startTime + 0.01, 0.08);
      harm3.connect(harm3Gain);
      harm3Gain.connect(env);

      const stopAt = startTime + duration + 0.1;
      mod.start(startTime);
      mod.stop(stopAt);
      carrier.start(startTime);
      carrier.stop(stopAt);
      harm2.start(startTime);
      harm2.stop(stopAt);
      harm3.start(startTime);
      harm3.stop(stopAt);

      voice.nodes.push(mod, modGain, carrier, harm2, harm2Gain, harm3, harm3Gain, env);
    }

    this.trackVoice(voice);
  }

  /**
   * Warm pad: thick, slow, evolving texture.
   * 3 detuned sawtooths through a sweeping low-pass filter, slow attack/release.
   */
  private scheduleWarmPadChord(frequencies: number[], startTime: number, duration: number): void {
    const voice: ActiveVoice = { nodes: [], stopTime: startTime + duration };
    const noteGain = 0.7 / frequencies.length;

    for (const freq of frequencies) {
      // Slow swell envelope
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0, startTime);
      env.gain.linearRampToValueAtTime(noteGain, startTime + Math.min(0.8, duration * 0.3));
      env.gain.setValueAtTime(noteGain, startTime + duration - Math.min(0.8, duration * 0.3));
      env.gain.linearRampToValueAtTime(0, startTime + duration);

      // Low-pass filter with slow sweep for movement
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, startTime);
      filter.frequency.linearRampToValueAtTime(1200, startTime + duration * 0.4);
      filter.frequency.linearRampToValueAtTime(600, startTime + duration);
      filter.Q.value = 1.5;

      filter.connect(env);
      env.connect(this.masterGain);

      // Three detuned sawtooth oscillators for a wide, thick sound
      for (const detune of [-15, 0, 15]) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        osc.detune.value = detune;

        osc.connect(filter);
        osc.start(startTime);
        osc.stop(startTime + duration + 0.1);

        voice.nodes.push(osc);
      }

      voice.nodes.push(filter, env);
    }

    this.trackVoice(voice);
  }

  private trackVoice(voice: ActiveVoice): void {
    this.activeVoices.push(voice);
    setTimeout(() => {
      this.activeVoices = this.activeVoices.filter((v) => v !== voice);
    }, (voice.stopTime - this.ctx.currentTime) * 1000 + 200);
  }

  private fadeOutAllVoices(): void {
    const now = this.ctx.currentTime;
    for (const voice of this.activeVoices) {
      for (const node of voice.nodes) {
        if (node instanceof GainNode) {
          node.gain.cancelScheduledValues(now);
          node.gain.setValueAtTime(node.gain.value, now);
          node.gain.linearRampToValueAtTime(0, now + RELEASE_SEC);
        }
        if (node instanceof OscillatorNode) {
          try { node.stop(now + RELEASE_SEC + 0.01); } catch { /* already stopped */ }
        }
      }
    }
    this.activeVoices = [];
  }

  private killAllVoices(): void {
    const now = this.ctx.currentTime;
    for (const voice of this.activeVoices) {
      for (const node of voice.nodes) {
        if (node instanceof OscillatorNode) {
          try { node.stop(now); } catch { /* already stopped */ }
        }
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

  setToneType(tone: ToneType): void {
    if (tone === this.toneType) return;
    this.toneType = tone;

    // Re-trigger current chord immediately so the user hears the difference
    if (this.playing && this.progression.length > 0) {
      this.fadeOutAllVoices();
      const chord = this.progression[this.playingIndex];
      const voicing = buildVoicing(chord.rootPitchClass, chord.quality);
      const { bpm, beatsPerBar, barLength } = this.conductor.getSnapshot().config;
      const secsPerBeat = 60 / bpm;
      // Use remaining time as a rough duration
      const duration = beatsPerBar * barLength * secsPerBeat;
      this.scheduleChord(voicing.frequencies, this.ctx.currentTime + 0.05, duration);
    }

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
      toneType: this.toneType,
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
