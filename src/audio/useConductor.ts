import { useCallback, useSyncExternalStore } from 'react';
import { Conductor } from './conductor';

let instance: Conductor | null = null;

export function getConductor(): Conductor {
  if (!instance) {
    instance = new Conductor();
  }
  return instance;
}

export function useConductor() {
  const conductor = getConductor();

  const snapshot = useSyncExternalStore(
    conductor.subscribe,
    conductor.getSnapshot,
  );

  const play = useCallback(() => conductor.play(), [conductor]);
  const pause = useCallback(() => conductor.pause(), [conductor]);
  const stop = useCallback(() => conductor.stop(), [conductor]);
  const setBpm = useCallback((bpm: number) => conductor.setBpm(bpm), [conductor]);
  const setBarLength = useCallback((len: 1 | 2) => conductor.setBarLength(len), [conductor]);

  return {
    ...snapshot,
    play,
    pause,
    stop,
    setBpm,
    setBarLength,
    conductor,
  };
}
