import { useState } from 'react';
import { getMidiInput, useMidiInput } from '../../input/useMidiInput';
import { getMicInput, useMicInput } from '../../input/useMicInput';
import { useJudge } from '../../engine/useJudge';
import { Button, SectionHeading, Select } from '../primitives';

type InputKind = 'midi' | 'mic';

const KIND_NAMES: Record<InputKind, string> = { midi: 'MIDI', mic: 'microphone' };

export default function InputSetup() {
  const midi = useMidiInput();
  const mic = useMicInput();
  const { resetSession } = useJudge();
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState<InputKind>('midi');

  const active: InputKind | null = midi.isConnected ? 'midi' : mic.isConnected ? 'mic' : null;
  const input = active === 'mic' ? mic : midi;
  const error = attempted === 'midi' ? midi.error : mic.error;
  const other: InputKind = active === 'midi' ? 'mic' : 'midi';

  /** Connect a source. The working input and current results are only replaced once it succeeds. */
  async function use(kind: InputKind) {
    setBusy(true);
    setAttempted(kind);
    try {
      await (kind === 'midi' ? midi.requestAccess() : mic.requestAccess());
      const connected = (kind === 'midi' ? getMidiInput() : getMicInput()).getSnapshot().isConnected;
      if (connected) {
        if (kind === 'midi') mic.disconnect(); else midi.disconnect();
        resetSession();
      }
    } finally {
      setBusy(false);
    }
  }

  async function selectDevice(id: string) {
    if (!active || id === input.activeDevice?.id) return;
    setBusy(true);
    try {
      await input.connect(id);
      // A failed switch falls back to the previous device; the take continues.
      const source = active === 'midi' ? getMidiInput() : getMicInput();
      if (source.getSnapshot().activeDevice?.id === id) resetSession();
    } finally {
      setBusy(false);
    }
  }

  const status = busy
    ? 'Connecting…'
    : active
      ? 'Connected. Play a note: it shows under Heard in the play bar.'
      : 'No input connected. You can still listen without scoring.';

  return (
    <section aria-label="Input setup" className="space-y-2 text-xs">
      <SectionHeading>Input{active ? `: ${KIND_NAMES[active]}` : ''}</SectionHeading>
      <div className="flex flex-wrap gap-2">
        {active ? <>
          <Select
            label="Input device"
            className="w-full"
            disabled={busy}
            options={input.availableDevices.map((device) => ({ value: device.id, label: device.name }))}
            value={input.activeDevice?.id ?? ''}
            onChange={selectDevice}
          />
          <Button disabled={busy} onClick={() => input.disconnect()}>Disconnect</Button>
          <Button disabled={busy} onClick={() => use(other)}>Switch to {KIND_NAMES[other]}</Button>
        </> : <>
          <Button disabled={busy} onClick={() => use('midi')}>Connect MIDI</Button>
          <Button disabled={busy} onClick={() => use('mic')}>Connect microphone</Button>
        </>}
      </div>
      <p role="status" className="text-ink">{status}</p>
      {error && <p role="alert" className="text-amber-300">{error}</p>}
      {active && <p className="text-ink-muted">{active === 'mic'
        ? 'Microphone: play one note at a time and use headphones to keep accompaniment out of the mic. A stable pitch counts once; leave a short silence to repeat it. Fast notes may be missed.'
        : 'MIDI: each note-on counts once. Switching input or device starts a new take.'}</p>}
    </section>
  );
}
