import type { PitchClass } from '../engine/chordData.types';
import type { MidiDeviceInfo, MidiInputSnapshot } from './midiInput.types';
import type { Connection } from './connection';

const UNSUPPORTED = 'MIDI is unavailable in this browser. Try a browser with Web MIDI support.';

function midiSupported(): boolean {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
}

/** Support is checked when an input is created, not when this file loads. */
function emptySnapshot(): MidiInputSnapshot {
  return {
    connection: midiSupported() ? { status: 'idle' } : { status: 'unsupported', message: UNSUPPORTED },
    availableDevices: [],
    lastNote: null,
  };
}

export class MidiInput {
  private noteCallback: (pitchClass: PitchClass) => void;
  private midiAccess: MIDIAccess | null = null;
  private activeInput: MIDIInput | null = null;

  private snapshotListeners = new Set<() => void>();
  private currentSnapshot: MidiInputSnapshot = emptySnapshot();

  // Bound handlers for proper removal
  private boundHandleMidiMessage = (e: MIDIMessageEvent) => this.handleMidiMessage(e);
  private boundHandleStateChange = () => this.handleStateChange();

  constructor(noteCallback: (pitchClass: PitchClass) => void) {
    this.noteCallback = noteCallback;
  }

  async requestAccess(): Promise<void> {
    if (!midiSupported()) {
      this.setConnection({ status: 'unsupported', message: UNSUPPORTED });
      return;
    }

    this.detachListener();
    this.activeInput = null;
    this.setConnection({ status: 'requesting' });
    try {
      this.midiAccess?.removeEventListener('statechange', this.boundHandleStateChange);
      this.midiAccess = await navigator.requestMIDIAccess();
      this.midiAccess.addEventListener('statechange', this.boundHandleStateChange);
      this.updateAvailableDevices();
      // Connect to the first available input.
      this.connect();
    } catch {
      // The player declined, or the browser refused.
      this.setConnection({ status: 'failed', message: 'MIDI access failed. Check browser permissions and reconnect your device.' });
    }
  }

  connect(deviceId?: string): void {
    if (!this.midiAccess) return;

    this.detachListener();
    this.activeInput = null;

    const inputs = Array.from(this.midiAccess.inputs.values());
    const target = deviceId
      ? inputs.find((input) => input.id === deviceId)
      : inputs[0];

    if (!target) {
      this.setConnection({ status: 'failed', message: deviceId
        ? 'That MIDI device is no longer available. Reconnect it and try again.'
        : 'No MIDI inputs found. Connect a keyboard and try again.' });
      return;
    }

    target.addEventListener('midimessage', this.boundHandleMidiMessage);
    this.activeInput = target;
    this.setConnection({
      status: 'connected',
      device: { id: target.id, name: target.name ?? 'Unknown Device', manufacturer: target.manufacturer ?? 'Unknown' },
      notice: null,
    });
  }

  disconnect(): void {
    this.detachListener();
    this.activeInput = null;
    this.setConnection({ status: 'idle' });
  }

  /** The only place the connection state changes. No note can be showing unless connected. */
  private setConnection(connection: Connection<MidiDeviceInfo>): void {
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
    } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
      if (this.currentSnapshot.lastNote?.midiNote === note) {
        this.currentSnapshot = { ...this.currentSnapshot, lastNote: null };
        this.notify();
      }
    }
  }

  private handleStateChange(): void {
    this.updateAvailableDevices();

    // If active device was disconnected, clear connection
    if (this.activeInput && this.activeInput.state === 'disconnected') {
      this.detachListener();
      this.activeInput = null;
      this.setConnection({ status: 'failed', message: 'The MIDI device was disconnected. Reconnect it and connect again.' });
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
