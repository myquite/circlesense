import { NoteGate } from './noteGate';
import type { PitchClass } from '../engine/chordData.types';
import type { MicDeviceInfo, MicInputSnapshot } from './micInput.types';
import type { AudioHost } from '../audio/audioHost';
import { deviceOf, type Connection } from './connection';
import { yinDetect, frequencyToPitchClass, computeRMS } from './pitchDetector';

const BUFFER_SIZE = 2048;
const CONFIDENCE_THRESHOLD = 0.9;
const SILENCE_THRESHOLD = 0.01; // RMS energy below this is considered silence

const UNSUPPORTED = 'Microphone access requires a supported browser and HTTPS or localhost.';

function micSupported(): boolean {
  return typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    'getUserMedia' in navigator.mediaDevices;
}

/** Support is checked when an input is created, not when this file loads. */
function emptySnapshot(): MicInputSnapshot {
  return {
    connection: micSupported() ? { status: 'idle' } : { status: 'unsupported', message: UNSUPPORTED },
    availableDevices: [],
    lastNote: null,
  };
}

/** Say what went wrong in terms the player can act on. */
function describeFailure(cause: unknown): string {
  const name = cause instanceof Error ? cause.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone permission was blocked. Allow the microphone for this site in your browser settings, then try again.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No microphone was found. Check that one is connected and try again.';
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'The microphone is in use or unavailable. Close other apps using it and try again.';
  }
  return `Microphone access failed${name ? ` (${name})` : ''}. Check browser permissions and that the selected device is available.`;
}

export class MicInput {
  private gate = new NoteGate();
  private connectionVersion = 0;
  private noteCallback: (pitchClass: PitchClass) => void;
  private audio: AudioHost;
  private releaseCapture: (() => void) | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private buffer = new Float32Array(BUFFER_SIZE);

  private snapshotListeners = new Set<() => void>();
  private currentSnapshot: MicInputSnapshot = emptySnapshot();

  /** `audio` owns the AudioContext and the capture session; the microphone only borrows them. */
  constructor(noteCallback: (pitchClass: PitchClass) => void, audio: AudioHost) {
    this.noteCallback = noteCallback;
    this.audio = audio;
  }

  async requestAccess(): Promise<void> {
    if (!micSupported()) {
      this.setConnection({ status: 'unsupported', message: UNSUPPORTED });
      return;
    }

    // Still inside the tap that asked for the microphone, so the browser will allow it.
    this.audio.wake();

    await this.connect();
  }

  async connect(deviceId?: string): Promise<void> {
    const previousId = deviceOf(this.currentSnapshot.connection)?.id;
    this.disconnectInternal();
    const version = this.connectionVersion;
    this.setConnection({ status: 'requesting' });
    try {
      // Before asking for the microphone: Safari refuses capture while the session is playback-only.
      this.releaseCapture = this.audio.beginCapture();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      if (version !== this.connectionVersion) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      // Opening the microphone can park the output on iOS.
      this.audio.wake();
      this.analyser = this.audio.context.createAnalyser();
      this.analyser.fftSize = BUFFER_SIZE;
      this.sourceNode = this.audio.context.createMediaStreamSource(stream);
      this.sourceNode.connect(this.analyser);
      const track = stream.getAudioTracks()[0];
      track.addEventListener('ended', () => {
        if (version !== this.connectionVersion) return;
        this.disconnectInternal();
        this.setConnection({ status: 'failed', message: 'The microphone was disconnected. Reconnect it and connect again.' });
      });
      this.setConnection({
        status: 'connected',
        device: { id: track.getSettings().deviceId ?? deviceId ?? 'default', name: track.label || 'Microphone' },
        notice: null,
      });
      this.detectionLoop();
      await this.updateAvailableDevices();
    } catch (cause) {
      if (version !== this.connectionVersion) return;
      this.disconnectInternal();
      // A failed switch should not cost the player the microphone that was working.
      if (deviceId && previousId && previousId !== deviceId) {
        await this.connect(previousId);
        const restored = this.currentSnapshot.connection;
        if (restored.status === 'connected') {
          this.setConnection({ ...restored, notice: 'Could not switch to that microphone. Still using the previous one.' });
          return;
        }
      }
      this.setConnection({ status: 'failed', message: describeFailure(cause) });
    }
  }

  disconnect(): void {
    this.disconnectInternal();
    this.setConnection({ status: 'idle' });
  }

  /** The only place the connection state changes. No note can be showing unless connected. */
  private setConnection(connection: Connection<MicDeviceInfo>): void {
    this.currentSnapshot = {
      ...this.currentSnapshot,
      connection,
      lastNote: connection.status === 'connected' ? this.currentSnapshot.lastNote : null,
    };
    this.notify();
  }

  // --- useSyncExternalStore support ---

  subscribe = (callback: () => void): (() => void) => {
    this.snapshotListeners.add(callback);
    return () => {
      this.snapshotListeners.delete(callback);
    };
  };

  getSnapshot = (): MicInputSnapshot => {
    return this.currentSnapshot;
  };

  dispose(): void {
    this.disconnectInternal();
    this.snapshotListeners.clear();
  }

  // --- Internal ---

  private detectionLoop = (): void => {
    if (!this.analyser) return;

    this.analyser.getFloatTimeDomainData(this.buffer);

    const rms = computeRMS(this.buffer);
    const result = rms > SILENCE_THRESHOLD
      ? yinDetect(this.buffer, this.audio.context.sampleRate) : null;
    const valid = result && result.confidence >= CONFIDENCE_THRESHOLD;
    const pitchClass = valid ? frequencyToPitchClass(result.frequency) : null;
    // Publish only when the displayed note changes, not on every animation frame.
    if ((this.currentSnapshot.lastNote?.pitchClass ?? null) !== pitchClass) {
      this.currentSnapshot = {
        ...this.currentSnapshot,
        lastNote: valid && pitchClass !== null
          ? { frequency: result.frequency, pitchClass, confidence: result.confidence } : null,
      };
      this.notify();
    }
    const onset = this.gate.update(pitchClass, performance.now());
    if (onset !== null) this.noteCallback(onset);

    this.animFrameId = requestAnimationFrame(this.detectionLoop);
  };

  private disconnectInternal(): void {
    this.connectionVersion++;
    this.gate = new NoteGate();
    // Cancel detection loop
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    // Disconnect audio nodes
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.analyser = null;


    // Stop media stream tracks
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    this.releaseCapture?.();
    this.releaseCapture = null;
  }

  private async updateAvailableDevices(): Promise<void> {
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = allDevices.filter((d) => d.kind === 'audioinput');

    const devices: MicDeviceInfo[] = audioInputs.map((d) => ({
      id: d.deviceId,
      name: d.label || 'Microphone',
    }));

    this.currentSnapshot = {
      ...this.currentSnapshot,
      availableDevices: devices,
    };
    this.notify();
  }

  private notify(): void {
    for (const cb of this.snapshotListeners) {
      cb();
    }
  }
}
