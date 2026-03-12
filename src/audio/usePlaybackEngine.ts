import { useCallback, useSyncExternalStore } from 'react';
import { PlaybackEngine } from './playbackEngine';
import { getConductor } from './useConductor';
import type { ChordDefinition } from '../engine/chordData.types';
import type { PlaybackDirection, PlaybackMode, ToneType } from './playbackEngine.types';

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

  const setProgression = useCallback(
    (chords: ChordDefinition[]) => engine.setProgression(chords),
    [engine],
  );

  const addChord = useCallback(
    (chord: ChordDefinition) => engine.addChord(chord),
    [engine],
  );

  const removeChord = useCallback(
    (index: number) => engine.removeChord(index),
    [engine],
  );

  const clearProgression = useCallback(
    () => engine.clearProgression(),
    [engine],
  );

  const setDirection = useCallback(
    (dir: PlaybackDirection) => engine.setDirection(dir),
    [engine],
  );

  const setPlaybackMode = useCallback(
    (mode: PlaybackMode) => engine.setPlaybackMode(mode),
    [engine],
  );

  const setToneType = useCallback(
    (tone: ToneType) => engine.setToneType(tone),
    [engine],
  );

  return {
    ...snapshot,
    setProgression,
    addChord,
    removeChord,
    clearProgression,
    setDirection,
    setPlaybackMode,
    setToneType,
  };
}
