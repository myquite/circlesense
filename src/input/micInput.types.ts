import type { PitchClass } from '../engine/chordData.types';
import type { Connection } from './connection';

export interface MicDeviceInfo {
  id: string;
  name: string;
}

export interface MicInputSnapshot {
  connection: Connection<MicDeviceInfo>;
  availableDevices: MicDeviceInfo[];
  lastNote: {
    frequency: number;
    pitchClass: PitchClass;
    confidence: number;
  } | null;
}
