import type { PitchClass } from './chordData.types';

export interface DetectedNote {
  pitchClass: PitchClass;
  timestamp: number;
}

export interface OutOfScaleEntry {
  pitchClass: PitchClass;
  noteName: string;
  count: number;
}

export interface JudgeSnapshot {
  lastDetectedNote: PitchClass | null;
  lastDetectedName: string | null;
  isInChord: boolean;
  isInScale: boolean;
  currentBarAccuracy: number;
  currentBarTotal: number;
  sessionAccuracy: number;
  sessionTotal: number;
  outOfScaleLog: OutOfScaleEntry[];
  isActive: boolean;
}
