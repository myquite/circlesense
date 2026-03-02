import { useCallback, useSyncExternalStore } from 'react';
import { PlaybackEngine } from './playbackEngine';
import { getConductor } from './useConductor';
import type { ChordQuality, NoteName } from '../engine/chordData.types';
import type { PlaybackDirection } from './playbackEngine.types';

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

  const setKey = useCallback(
    (key: NoteName) => engine.setKey(key),
    [engine],
  );

  const setChordQuality = useCallback(
    (quality: ChordQuality) => engine.setChordQuality(quality),
    [engine],
  );

  const setDirection = useCallback(
    (dir: PlaybackDirection) => engine.setDirection(dir),
    [engine],
  );

  return {
    ...snapshot,
    setKey,
    setChordQuality,
    setDirection,
  };
}
