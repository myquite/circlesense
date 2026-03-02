import type { PitchClass } from '../engine/chordData.types';
import type { MicDeviceInfo, MicInputSnapshot } from './micInput.types';
import { yinDetect, frequencyToPitchClass, computeRMS } from './pitchDetector';

const BUFFER_SIZE = 2048;
const CONFIDENCE_THRESHOLD = 0.9;
const SILENCE_THRESHOLD = 0.01; // RMS energy below this is considered silence

const EMPTY_SNAPSHOT: MicInputSnapshot = {
  isSupported:
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    'getUserMedia' in navigator.mediaDevices,
  isConnected: false,
  activeDevice: null,
  availableDevices: [],
  lastNote: null,
};

export class MicInput {
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
      this.currentSnapshot = { ...this.currentSnapshot, isSupported: false };
      this.notify();
      return;
    }

    try {
      // Request mic access to trigger permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the temporary stream — we'll create a proper one in connect()
      for (const track of stream.getTracks()) {
        track.stop();
      }

      // Enumerate devices now that we have permission
      await this.updateAvailableDevices();

      // Auto-connect to first available device
      if (this.currentSnapshot.availableDevices.length > 0) {
        await this.connect();
      }
    } catch {
      // User denied access or browser error
      this.currentSnapshot = { ...this.currentSnapshot, isSupported: false };
      this.notify();
    }
  }

  async connect(deviceId?: string): Promise<void> {
    // Disconnect any existing connection first
    this.disconnectInternal();

    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId
          ? { deviceId: { exact: deviceId } }
          : true,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create audio context and analyser
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = BUFFER_SIZE;

      // Connect stream → analyser (no output — we only read data)
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
      this.sourceNode.connect(this.analyser);

      // Identify connected device
      const track = this.stream.getAudioTracks()[0];
      const settings = track.getSettings();
      const device: MicDeviceInfo = {
        id: settings.deviceId ?? deviceId ?? 'default',
        name: track.label || 'Microphone',
      };

      this.currentSnapshot = {
        ...this.currentSnapshot,
        isConnected: true,
        activeDevice: device,
      };
      this.notify();

      // Start detection loop
      this.detectionLoop();
    } catch {
      this.currentSnapshot = {
        ...this.currentSnapshot,
        isConnected: false,
        activeDevice: null,
      };
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

    // Silence gate: skip detection if signal is too quiet
    const rms = computeRMS(this.buffer);
    if (rms > SILENCE_THRESHOLD) {
      const result = yinDetect(this.buffer, this.audioContext!.sampleRate);

      if (result && result.confidence >= CONFIDENCE_THRESHOLD) {
        const pitchClass = frequencyToPitchClass(result.frequency);

        this.currentSnapshot = {
          ...this.currentSnapshot,
          lastNote: {
            frequency: result.frequency,
            pitchClass,
            confidence: result.confidence,
          },
        };
        this.notify();

        this.noteCallback(pitchClass);
      }
    }

    this.animFrameId = requestAnimationFrame(this.detectionLoop);
  };

  private disconnectInternal(): void {
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
