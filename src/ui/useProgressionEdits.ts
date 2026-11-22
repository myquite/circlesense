import { useCallback, useSyncExternalStore } from 'react';
import { usePlaybackEngine } from '../audio/usePlaybackEngine';
import type { ChordDefinition } from '../engine/chordData.types';
import type { PlaybackDirection, PlaybackMode } from '../audio/playbackEngine.types';

interface UndoState {
  message: string;
  progression: ChordDefinition[];
  playbackMode: PlaybackMode;
  direction: PlaybackDirection;
  /** Signature of the progression the edit produced; undo is offered only while it still stands. */
  after: string;
}

function signature(chords: ChordDefinition[]): string {
  return chords.map((c) => c.label).join('|');
}

// One undo slot shared by every place that edits the progression (setup list, circle).
let stored: UndoState | null = null;
const listeners = new Set<() => void>();
function setStored(next: UndoState | null) {
  stored = next;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Progression edits with a one-step undo that also restores chord order and direction. */
export function useProgressionEdits() {
  const { progression, playbackMode, direction, setProgression, setPlaybackMode, setDirection } = usePlaybackEngine();
  const current = useSyncExternalStore(subscribe, () => stored);
  const undo = current && current.after === signature(progression) ? current : null;

  const replaceProgression = useCallback((next: ChordDefinition[], message: string) => {
    const before = { message, progression, playbackMode, direction, after: signature(next) };
    setProgression(next);
    setStored(before);
  }, [progression, playbackMode, direction, setProgression]);

  const applyUndo = useCallback(() => {
    if (!undo) return;
    setProgression(undo.progression);
    setPlaybackMode(undo.playbackMode);
    setDirection(undo.direction);
    setStored(null);
  }, [undo, setProgression, setPlaybackMode, setDirection]);

  return { undo, replaceProgression, applyUndo };
}
