import { useCallback, useSyncExternalStore } from 'react';
import { MidiInput } from './midiInput';
import { getJudge } from '../engine/useJudge';

let instance: MidiInput | null = null;

export function getMidiInput(): MidiInput {
  if (!instance) {
    instance = new MidiInput((pitchClass) => getJudge().submitNote(pitchClass));
  }
  return instance;
}

export function useMidiInput() {
  const midi = getMidiInput();

  const snapshot = useSyncExternalStore(
    midi.subscribe,
    midi.getSnapshot,
  );

  const requestAccess = useCallback(() => midi.requestAccess(), [midi]);
  const connect = useCallback((deviceId?: string) => midi.connect(deviceId), [midi]);
  const disconnect = useCallback(() => midi.disconnect(), [midi]);

  return {
    ...snapshot,
    requestAccess,
    connect,
    disconnect,
  };
}
