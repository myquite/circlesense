import { useCallback, useSyncExternalStore } from 'react';
import { MicInput } from './micInput';
import { getJudge } from '../engine/useJudge';

let instance: MicInput | null = null;

export function getMicInput(): MicInput {
  if (!instance) {
    instance = new MicInput((pitchClass) => getJudge().submitNote(pitchClass));
  }
  return instance;
}

export function useMicInput() {
  const mic = getMicInput();

  const snapshot = useSyncExternalStore(
    mic.subscribe,
    mic.getSnapshot,
  );

  const requestAccess = useCallback(() => mic.requestAccess(), [mic]);
  const connect = useCallback((deviceId?: string) => mic.connect(deviceId), [mic]);
  const disconnect = useCallback(() => mic.disconnect(), [mic]);

  return {
    ...snapshot,
    requestAccess,
    connect,
    disconnect,
  };
}
