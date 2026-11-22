import type { PitchClass } from './chordData.types';

export interface DetectedNote {
  pitchClass: PitchClass;
  timestamp: number;
}

export interface OutsideTargetEntry {
  pitchClass: PitchClass;
  noteName: string;
  /** Label of the chord the note was played over. */
  chordLabel: string;
  count: number;
}

export type PracticeTarget = 'chord' | 'third' | 'guide';

/** Summary of the take that was replaced by the current one. */
export interface TakeSummary {
  target: PracticeTarget;
  accuracy: number;
  total: number;
}

export interface JudgeSnapshot {
  target: PracticeTarget;
  lastDetectedNote: PitchClass | null;
  lastDetectedName: string | null;
  isTargetHit: boolean;
  currentBarAccuracy: number;
  currentBarTotal: number;
  sessionAccuracy: number;
  sessionTotal: number;
  outsideTargetLog: OutsideTargetEntry[];
  isActive: boolean;
  previousTake: TakeSummary | null;
}
