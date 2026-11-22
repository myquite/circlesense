import type { PitchClass } from '../engine/chordData.types';

/** One observation per stable pitch; silence rearms repeated notes. Times are milliseconds. */
export class NoteGate {
  private candidate: PitchClass | null = null;
  private candidateSince = 0;
  private emitted: PitchClass | null = null;
  private lastSignal = -Infinity;

  update(pitch: PitchClass | null, now: number): PitchClass | null {
    if (pitch === null) {
      this.candidate = null;
      if (now - this.lastSignal >= 120) this.emitted = null;
      return null;
    }
    if (now - this.lastSignal >= 120) this.emitted = null;
    this.lastSignal = now;
    if (pitch !== this.candidate) {
      this.candidate = pitch;
      this.candidateSince = now;
    }
    if (now - this.candidateSince >= 80 && this.emitted !== pitch) {
      this.emitted = pitch;
      return pitch;
    }
    return null;
  }
}
