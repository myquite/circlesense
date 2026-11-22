import type { PitchClass } from '../engine/chordData.types';
import type { Connection } from './connection';

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export interface MidiInputSnapshot {
  connection: Connection<MidiDeviceInfo>;
  availableDevices: MidiDeviceInfo[];
  lastNote: {
    midiNote: number;
    pitchClass: PitchClass;
    velocity: number;
  } | null;
}
