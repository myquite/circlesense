import type { PitchClass } from '../engine/chordData.types';

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export interface MidiInputSnapshot {
  isSupported: boolean;
  isConnected: boolean;
  activeDevice: MidiDeviceInfo | null;
  availableDevices: MidiDeviceInfo[];
  lastNote: {
    midiNote: number;
    pitchClass: PitchClass;
    velocity: number;
  } | null;
}
