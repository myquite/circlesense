import { NoteGate } from './noteGate';
import type { PitchClass } from '../engine/chordData.types';
import type { MicDeviceInfo, MicInputSnapshot } from './micInput.types';
import { setAudioSession } from '../audio/audioSession';
import { yinDetect, frequencyToPitchClass, computeRMS } from './pitchDetector';

const BUFFER_SIZE = 2048;
const CONFIDENCE_THRESHOLD = 0.9;
const SILENCE_THRESHOLD = 0.01; // RMS energy below this is considered silence

const EMPTY_SNAPSHOT: MicInputSnapshot = {
  isSupported:
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    'getUserMedia' in navigator.mediaDevices,
  error: null,
  isConnected: false,
  activeDevice: null,
  availableDevices: [],
  lastNote: null,
};

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
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private buffer = new Float32Array(BUFFER_SIZE);

  private snapshotListeners = new Set<() => void>();
  private currentSnapshot: MicInputSnapshot = { ...EMPTY_SNAPSHOT };

  constructor(noteCallback: (pitchClass: PitchClass) => void) {
    this.noteCallback = noteCallback;
  }

  async requestAccess(): Promise<void> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !('getUserMedia' in navigator.mediaDevices)
    ) {
      this.currentSnapshot = { ...this.currentSnapshot, isSupported: false, error: 'Microphone access requires a supported browser and HTTPS or localhost.' };
      this.notify();
      return;
    }

    await this.connect();
  }

  async connect(deviceId?: string): Promise<void> {
    const previousId = this.currentSnapshot.activeDevice?.id;
    this.disconnectInternal();
    const version = this.connectionVersion;
    this.currentSnapshot = { ...this.currentSnapshot, isConnected: false, lastNote: null, activeDevice: null, error: null };
    this.notify();
    try {
      // Before asking for the microphone: Safari refuses capture while the session is playback-only.
      setAudioSession('play-and-record');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      if (version !== this.connectionVersion) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.audioContext = new AudioContext();
      await this.audioContext.resume();
      if (version !== this.connectionVersion) return;
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = BUFFER_SIZE;
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.sourceNode.connect(this.analyser);
      const track = stream.getAudioTracks()[0];
      track.addEventListener('ended', () => {
        if (version !== this.connectionVersion) return;
        this.disconnect();
        this.currentSnapshot = { ...this.currentSnapshot, error: 'The microphone was disconnected. Reconnect it and connect again.' };
        this.notify();
      });
      this.currentSnapshot = {
        ...this.currentSnapshot, isConnected: true, error: null,
        activeDevice: { id: track.getSettings().deviceId ?? deviceId ?? 'default', name: track.label || 'Microphone' },
      };
      this.notify();
      this.detectionLoop();
      await this.updateAvailableDevices();
    } catch (cause) {
      if (version !== this.connectionVersion) return;
      this.disconnectInternal();
      // A failed switch should not cost the player the microphone that was working.
      if (deviceId && previousId && previousId !== deviceId) {
        await this.connect(previousId);
        if (this.currentSnapshot.isConnected) {
          this.currentSnapshot = { ...this.currentSnapshot,
            error: 'Could not switch to that microphone. Still using the previous one.' };
          this.notify();
          return;
        }
      }
      this.currentSnapshot = { ...this.currentSnapshot, isConnected: false, activeDevice: null, error: describeFailure(cause) };
      this.notify();
    }
  }

  disconnect(): void {
    this.disconnectInternal();
    this.currentSnapshot = {
      ...this.currentSnapshot,
      isConnected: false,
      activeDevice: null,
      lastNote: null,
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
      ? yinDetect(this.buffer, this.audioContext!.sampleRate) : null;
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

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Stop media stream tracks
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    setAudioSession('playback');
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
