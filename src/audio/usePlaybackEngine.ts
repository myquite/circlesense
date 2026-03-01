import { useCallback, useSyncExternalStore } from 'react';
import { PlaybackEngine } from './playbackEngine';
import { getConductor } from './useConductor';
import type { ChordQuality } from '../engine/chordData.types';

let instance: PlaybackEngine | null = null;

export function getPlaybackEngine(): PlaybackEngine {
  if (!instance) {
    instance = new PlaybackEngine(getConductor());
  }
  return instance;
}

export function usePlaybackEngine() {
  const engine = getPlaybackEngine();

  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
  );

  const setChordQuality = useCallback(
    (quality: ChordQuality) => engine.setChordQuality(quality),
    [engine],
  );

  return {
    ...snapshot,
    setChordQuality,
  };
}
