import type { PitchClass } from '../engine/chordData.types';

export interface MicDeviceInfo {
  id: string;
  name: string;
}

export interface MicInputSnapshot {
  isSupported: boolean;
  isConnected: boolean;
  activeDevice: MicDeviceInfo | null;
  availableDevices: MicDeviceInfo[];
  lastNote: {
    frequency: number;
    pitchClass: PitchClass;
    confidence: number;
  } | null;
}
