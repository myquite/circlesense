import { useCallback, useSyncExternalStore } from 'react';
import { Judge } from './judge';
import { getConductor } from '../audio/useConductor';
import { getPlaybackEngine } from '../audio/usePlaybackEngine';
import type { PracticeTarget } from './judge.types';
import type { PitchClass } from './chordData.types';

let instance: Judge | null = null;

export function getJudge(): Judge {
  if (!instance) {
    instance = new Judge(getConductor(), getPlaybackEngine());
  }
  return instance;
}

export function useJudge() {
  const judge = getJudge();

  const snapshot = useSyncExternalStore(
    judge.subscribe,
    judge.getSnapshot,
  );

  const submitNote = useCallback(
    (pitchClass: PitchClass) => judge.submitNote(pitchClass),
    [judge],
  );

  const resetSession = useCallback(
    () => judge.resetSession(),
    [judge],
  );

  const clearResults = useCallback(() => judge.clearResults(), [judge]);

  const setTarget = useCallback((target: PracticeTarget) => judge.setTarget(target), [judge]);

  return {
    ...snapshot,
    submitNote,
    resetSession,
    clearResults,
    setTarget,
  };
}
