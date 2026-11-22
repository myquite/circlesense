import { getMidiInput, useMidiInput } from '../../input/useMidiInput';
import { getMicInput, useMicInput } from '../../input/useMicInput';
import { useJudge } from '../../engine/useJudge';
import { Button, SectionHeading, Select } from '../primitives';
import { deviceOf, failureOf, isConnected } from '../../input/connection';

type InputKind = 'midi' | 'mic';

const KIND_NAMES: Record<InputKind, string> = { midi: 'MIDI', mic: 'microphone' };

export default function InputSetup() {
  const midi = useMidiInput();
  const mic = useMicInput();
  const { resetSession } = useJudge();

  // Everything shown here is read from the two connection states; there is no separate UI state to drift.
  const active: InputKind | null = isConnected(midi.connection) ? 'midi' : isConnected(mic.connection) ? 'mic' : null;
  const busy = midi.connection.status === 'requesting' || mic.connection.status === 'requesting';
  const midiSupported = midi.connection.status !== 'unsupported';
  const input = active === 'mic' ? mic : midi;
  const device = deviceOf(input.connection);
  const other: InputKind = active === 'midi' ? 'mic' : 'midi';
  const failures = [failureOf(midi.connection), failureOf(mic.connection)].filter((message) => message !== null);
  const notice = input.connection.status === 'connected' ? input.connection.notice : null;

  /** Connect a source. The working input and current results are only replaced once it succeeds. */
  async function use(kind: InputKind) {
    await (kind === 'midi' ? midi.requestAccess() : mic.requestAccess());
    const source = kind === 'midi' ? getMidiInput() : getMicInput();
    if (isConnected(source.getSnapshot().connection)) {
      if (kind === 'midi') mic.disconnect(); else midi.disconnect();
      resetSession();
    }
  }

  async function selectDevice(id: string) {
    if (!active || id === device?.id) return;
    await input.connect(id);
    // A failed switch falls back to the previous device; the take continues.
    const source = active === 'midi' ? getMidiInput() : getMicInput();
    if (deviceOf(source.getSnapshot().connection)?.id === id) resetSession();
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
            value={device?.id ?? ''}
            onChange={selectDevice}
          />
          <Button disabled={busy} onClick={() => input.disconnect()}>Disconnect</Button>
          {(other === 'mic' || midiSupported) && (
            <Button disabled={busy} onClick={() => use(other)}>Switch to {KIND_NAMES[other]}</Button>
          )}
        </> : <>
          {midiSupported && <Button disabled={busy} onClick={() => use('midi')}>Connect MIDI</Button>}
          <Button disabled={busy} onClick={() => use('mic')}>Connect microphone</Button>
        </>}
      </div>
      <p role="status" className="text-ink">{status}</p>
      {/* Phones on iOS have no Web MIDI; say so instead of offering a button that can only fail. */}
      {!midiSupported && <p className="text-ink-muted">MIDI is not available in this browser, so the microphone is the input here.</p>}
      {notice && <p role="status" className="text-amber-300">{notice}</p>}
      {failures.map((message) => <p key={message} role="alert" className="text-amber-300">{message}</p>)}
      {active && <p className="text-ink-muted">{active === 'mic'
        ? 'Microphone: play one note at a time and use headphones to keep accompaniment out of the mic. A stable pitch counts once; leave a short silence to repeat it. Fast notes may be missed.'
        : 'MIDI: each note-on counts once. Switching input or device starts a new take.'}</p>}
    </section>
  );
}
