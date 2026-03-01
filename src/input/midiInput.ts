import type { PitchClass } from '../engine/chordData.types';
import type { MidiDeviceInfo, MidiInputSnapshot } from './midiInput.types';

const EMPTY_SNAPSHOT: MidiInputSnapshot = {
  isSupported: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator,
  isConnected: false,
  activeDevice: null,
  availableDevices: [],
  lastNote: null,
};

export class MidiInput {
  private noteCallback: (pitchClass: PitchClass) => void;
  private midiAccess: MIDIAccess | null = null;
  private activeInput: MIDIInput | null = null;

  private snapshotListeners = new Set<() => void>();
  private currentSnapshot: MidiInputSnapshot = { ...EMPTY_SNAPSHOT };

  // Bound handlers for proper removal
  private boundHandleMidiMessage = (e: MIDIMessageEvent) => this.handleMidiMessage(e);
  private boundHandleStateChange = (e: Event) =>
    this.handleStateChange(e as MIDIConnectionEvent);

  constructor(noteCallback: (pitchClass: PitchClass) => void) {
    this.noteCallback = noteCallback;
  }

  async requestAccess(): Promise<void> {
    if (!('requestMIDIAccess' in navigator)) {
      this.currentSnapshot = { ...this.currentSnapshot, isSupported: false };
      this.notify();
      return;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      this.midiAccess.addEventListener('statechange', this.boundHandleStateChange);
      this.updateAvailableDevices();

      // Auto-connect to first available input
      if (this.currentSnapshot.availableDevices.length > 0) {
        this.connect();
      }
    } catch {
      // User denied access or browser error
      this.currentSnapshot = { ...this.currentSnapshot, isSupported: false };
      this.notify();
    }
  }

  connect(deviceId?: string): void {
    if (!this.midiAccess) return;

    // Disconnect current if any
    this.detachListener();

    const inputs = Array.from(this.midiAccess.inputs.values());
    const target = deviceId
      ? inputs.find((input) => input.id === deviceId)
      : inputs[0];

    if (!target) return;

    target.addEventListener('midimessage', this.boundHandleMidiMessage);
    this.activeInput = target;

    this.currentSnapshot = {
      ...this.currentSnapshot,
      isConnected: true,
      activeDevice: {
        id: target.id,
        name: target.name ?? 'Unknown Device',
        manufacturer: target.manufacturer ?? 'Unknown',
      },
    };
    this.notify();
  }

  disconnect(): void {
    this.detachListener();
    this.activeInput = null;

    this.currentSnapshot = {
      ...this.currentSnapshot,
      isConnected: false,
      activeDevice: null,
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

  getSnapshot = (): MidiInputSnapshot => {
    return this.currentSnapshot;
  };

  dispose(): void {
    this.detachListener();
    if (this.midiAccess) {
      this.midiAccess.removeEventListener('statechange', this.boundHandleStateChange);
      this.midiAccess = null;
    }
    this.snapshotListeners.clear();
  }

  // --- Internal ---

  private handleMidiMessage(event: MIDIMessageEvent): void {
    const data = event.data;
    if (!data || data.length < 3) return;

    const status = data[0] & 0xf0;
    const note = data[1];
    const velocity = data[2];

    // Note-on: status 0x90 with velocity > 0 (velocity 0 = note-off)
    if (status === 0x90 && velocity > 0) {
      const pitchClass = (note % 12) as PitchClass;

      this.currentSnapshot = {
        ...this.currentSnapshot,
        lastNote: { midiNote: note, pitchClass, velocity },
      };
      this.notify();

      this.noteCallback(pitchClass);
    }
  }

  private handleStateChange(_event: MIDIConnectionEvent): void {
    this.updateAvailableDevices();

    // If active device was disconnected, clear connection
    if (this.activeInput && this.activeInput.state === 'disconnected') {
      this.disconnect();
    }
  }

  private updateAvailableDevices(): void {
    if (!this.midiAccess) return;

    const devices: MidiDeviceInfo[] = [];
    for (const input of this.midiAccess.inputs.values()) {
      if (input.state === 'connected') {
        devices.push({
          id: input.id,
          name: input.name ?? 'Unknown Device',
          manufacturer: input.manufacturer ?? 'Unknown',
        });
      }
    }

    this.currentSnapshot = {
      ...this.currentSnapshot,
      availableDevices: devices,
    };
    this.notify();
  }

  private detachListener(): void {
    if (this.activeInput) {
      this.activeInput.removeEventListener('midimessage', this.boundHandleMidiMessage);
    }
  }

  private notify(): void {
    for (const cb of this.snapshotListeners) {
      cb();
    }
  }
}
