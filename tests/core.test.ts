import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { Conductor } from '../src/audio/conductor';
import { TRANSPORT_TRANSITIONS, canTransition, takePhase, type TransportState } from '../src/audio/conductor.types';
import { PlaybackEngine } from '../src/audio/playbackEngine';
import { Judge } from '../src/engine/judge';
import { buildExercise, matchExercise, EXERCISE_KINDS, KEY_MOVEMENT_KINDS, keyAt, toggleCircleChord, selectAllCircleChords, buildVoicing, chordToneNames, formatChordLabel, makeChordDefinition, spellPitchClass } from '../src/engine/chordData';
import { NoteGate } from '../src/input/noteGate';
import { yinDetect, frequencyToPitchClass, computeRMS } from '../src/input/pitchDetector';
import { MidiInput } from '../src/input/midiInput';
import { MicInput } from '../src/input/micInput';
import { deviceOf, failureOf } from '../src/input/connection';
import { AudioHost } from '../src/audio/audioHost';
import { loadSettings, startingProgression } from '../src/state/sessionStore';
import { transportShortcut } from '../src/ui/useTransportShortcuts';
import { homeScreenHeight } from '../src/ui/fitHomeScreenViewport';

// A deterministic clock drives the real scheduling, playback, and judging code.
// Only the browser's clock and audio nodes are replaced.
function harness(t: TestContext) {
  let now = 0;
  let id = 0;
  const timers = new Map<number, { at: number; interval: number; cb: () => void }>();
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  class Gain { gain = param(); connect() {} disconnect() {} }
  class Osc { frequency = param(); detune = param(); connect() {} start() {} stop() {} }
  class Context {
    get currentTime() { return now / 1000; }
    state = 'running'; destination = {};
    resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
    createGain() { return new Gain(); } createOscillator() { return new Osc(); }
    createBiquadFilter() { return { frequency: param(), Q: param(), connect() {} }; }
  }
  const original = new Map<string, PropertyDescriptor | undefined>();
  function replace(key: string, value: unknown) {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  replace('AudioContext', Context); replace('GainNode', Gain); replace('OscillatorNode', Osc);
  replace('setTimeout', (cb: () => void, delay = 0) => { timers.set(++id, { at: now + delay, interval: 0, cb }); return id; });
  replace('setInterval', (cb: () => void, delay: number) => { timers.set(++id, { at: now + delay, interval: delay, cb }); return id; });
  replace('clearTimeout', (key: number) => timers.delete(key));
  replace('clearInterval', (key: number) => timers.delete(key));
  const conductor = new Conductor();
  const playback = new PlaybackEngine(conductor);
  const judge = new Judge(conductor, playback);
  playback.setToneType('triangle');
  playback.setProgression([makeChordDefinition('C', 'C', 'major'), makeChordDefinition('G', 'G', 'major')]);
  function advance(to: number) {
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= to).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [key, timer] = next;
      now = timer.at;
      if (timer.interval) timer.at += timer.interval; else timers.delete(key);
      timer.cb();
    }
    now = to;
  }
  t.after(() => {
    judge.dispose(); playback.dispose(); conductor.dispose();
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  return { conductor, playback, judge, advance, replace };
}

for (const bpm of [60, 120, 240]) {
  test(`scheduled beat/bar times stay aligned at ${bpm} BPM over 10 simulated minutes`, (t) => {
    const { conductor, advance } = harness(t);
    conductor.setBpm(bpm);
    const beats: number[] = [];
    const bars: number[] = [];
    conductor.on('beat', (e) => beats.push(e.audioTime));
    conductor.on('bar', (e) => bars.push(e.audioTime));
    conductor.play();
    advance(600_000);
    const interval = 60 / bpm;
    assert.ok(beats.length > 500);
    beats.forEach((time, i) => assert.ok(Math.abs(time - (0.05 + 4 * interval + i * interval)) < 1e-8));
    bars.forEach((time, i) => assert.equal(time, beats[i * 4]));
  });
}

test('notes on both sides of an audible boundary use the correct chord and bar', (t) => {
  const { conductor, playback, judge, advance } = harness(t);
  conductor.play();
  advance(2000); // first chord is scheduled but not yet audible
  judge.submitNote(0);
  assert.equal(judge.getSnapshot().sessionTotal, 0);
  advance(4000); // G is scheduled for 4.05, C is still audible
  assert.equal(playback.getSnapshot().currentChord?.label, 'C');
  judge.submitNote(0);
  assert.equal(judge.getSnapshot().isTargetHit, true);
  advance(4051);
  assert.equal(playback.getSnapshot().currentChord?.label, 'G');
  assert.equal(judge.getSnapshot().currentBarTotal, 0);
  judge.submitNote(0);
  assert.equal(judge.getSnapshot().isTargetHit, false);
  judge.submitNote(11);
  assert.equal(judge.getSnapshot().isTargetHit, true);
  assert.equal(judge.getSnapshot().sessionTotal, 3);
});

test('each bar resets independently when a chord lasts multiple bars', (t) => {
  const { conductor, judge, advance } = harness(t);
  conductor.setBarLength(2); conductor.play(); advance(2100);
  judge.submitNote(0); advance(4100);
  assert.equal(judge.getSnapshot().currentBarTotal, 0);
  assert.equal(judge.getSnapshot().sessionTotal, 1);
});

test('pause resumes the same chord and retains results; stop preserves results; new play resets', (t) => {
  const { conductor, playback, judge, advance } = harness(t);
  conductor.play(); advance(4100); judge.submitNote(11);
  conductor.pause(); advance(5000);
  conductor.play(); advance(5100);
  // Resume counts in first: nothing is scored and the take is intact.
  assert.equal(conductor.getSnapshot().transport, 'counting-back');
  judge.submitNote(11);
  assert.equal(judge.getSnapshot().sessionTotal, 1);
  advance(7100);
  assert.equal(conductor.getSnapshot().transport, 'playing');
  assert.equal(playback.getSnapshot().currentChord?.label, 'G');
  assert.equal(playback.getCurrentChord()?.label, 'G');
  assert.equal(judge.getSnapshot().sessionTotal, 1);
  judge.submitNote(11); assert.equal(judge.getSnapshot().sessionAccuracy, 100);
  conductor.stop(); assert.equal(judge.getSnapshot().sessionTotal, 2);
  conductor.play(); assert.equal(judge.getSnapshot().sessionTotal, 0);
  assert.deepEqual(judge.getSnapshot().previousTake, { target: 'chord', accuracy: 100, total: 2 });
  judge.clearResults(); assert.equal(judge.getSnapshot().previousTake, null);
});

test('pause inside lookahead does not skip the currently audible chord', (t) => {
  const { conductor, playback, advance } = harness(t);
  conductor.play(); advance(4000); conductor.pause(); advance(5000);
  conductor.play(); advance(7100);
  assert.equal(playback.getCurrentChord()?.label, 'C');
});

test('editing a running progression stops sound and scoring', (t) => {
  const { conductor, playback, judge, advance } = harness(t);
  conductor.play(); advance(2100); judge.submitNote(0);
  playback.clearProgression(); judge.submitNote(0);
  assert.equal(conductor.getSnapshot().transport, 'stopped');
  assert.equal(playback.getCurrentChord(), null);
  assert.equal(judge.getSnapshot().sessionTotal, 1);
});

test('third and guide-tone targets score only the intended chord members', (t) => {
  const { conductor, playback, judge, advance } = harness(t);
  playback.setProgression(buildExercise(0, 'ii-v-i'));
  conductor.play(); advance(2100);
  judge.setTarget('third');
  judge.submitNote(5); judge.submitNote(2);
  assert.equal(judge.getSnapshot().sessionAccuracy, 50);
  judge.setTarget('guide');
  judge.submitNote(5); judge.submitNote(0); judge.submitNote(9);
  assert.equal(judge.getSnapshot().sessionAccuracy, 67);
});

test('exercises transpose and seventh voicings contain expected notes', () => {
  assert.deepEqual(buildExercise(0, 'ii-v-i').map((c) => c.label), ['Dm7', 'G7', 'Cmaj7']);
  assert.deepEqual(buildExercise(7, 'ii-v-i').map((c) => c.label), ['Am7', 'D7', 'Gmaj7']);
  assert.deepEqual(buildVoicing(7, 'dominant7').pitchClasses, [7, 11, 2, 5]);
  assert.equal(buildExercise(0, 'blues').length, 12);
});

test('microphone gate counts sustained notes once and rearms after silence', () => {
  const gate = new NoteGate();
  const notes = [];
  for (let time = 0; time < 1000; time += 16) {
    const note = gate.update(0, time); if (note !== null) notes.push(note);
  }
  assert.deepEqual(notes, [0]);
  gate.update(null, 1200); gate.update(0, 1210);
  assert.equal(gate.update(0, 1300), 0);
  gate.update(2, 1310); gate.update(0, 1320); // short transient is rejected
  assert.equal(gate.update(0, 1410), null);
  gate.update(2, 1420); assert.equal(gate.update(2, 1510), 2);
});

test('silence is rejected; synthetic A4 is confidently detected', () => {
  const silence = new Float32Array(2048);
  assert.equal(computeRMS(silence), 0); assert.equal(yinDetect(silence, 48000), null);
  const tone = Float32Array.from({ length: 2048 }, (_, i) => 0.4 * Math.sin(2 * Math.PI * 440 * i / 48000));
  const detected = yinDetect(tone, 48000)!;
  assert.ok(detected.confidence >= 0.9);
  assert.equal(frequencyToPitchClass(detected.frequency), 9);
});

test('MIDI counts all pitch classes accurately and ignores note-off messages', async (t) => {
  const { replace } = harness(t);
  const device = new EventTarget();
  Object.assign(device, { id: 'test', name: 'Test keyboard', state: 'connected' });
  const access = new EventTarget(); Object.assign(access, { inputs: new Map([['test', device]]) });
  replace('navigator', { requestMIDIAccess: async () => access });
  const notes: number[] = [];
  const midi = new MidiInput((pc) => notes.push(pc));
  await midi.requestAccess();
  assert.equal(midi.getSnapshot().connection.status, 'connected');
  for (let note = 0; note < 128; note++) {
    for (const [status, velocity] of [[0x90, 100], [0x90, 0], [0x80, 100]]) {
      const e = new Event('midimessage'); Object.assign(e, { data: [status, note, velocity] }); device.dispatchEvent(e);
    }
  }
  assert.deepEqual(notes, Array.from({ length: 128 }, (_, i) => i % 12));
  assert.equal(midi.getSnapshot().lastNote, null);
  // Unplugging the keyboard is a failure with a message; having no keyboard at all is too.
  Object.assign(device, { state: 'disconnected' });
  access.dispatchEvent(new Event('statechange'));
  assert.match(failureOf(midi.getSnapshot().connection) ?? '', /was disconnected/);
  (access as unknown as { inputs: Map<string, unknown> }).inputs.clear();
  await midi.requestAccess();
  assert.match(failureOf(midi.getSnapshot().connection) ?? '', /No MIDI inputs found/);
  midi.dispose();
});

test('stored malformed chords are rejected and legacy valid settings still load', (t) => {
  const { replace } = harness(t);
  const settings = { bpm: 120, barLength: 1, direction: 'clockwise', progression: [{ quality: 'oops' }] };
  replace('localStorage', { getItem: () => JSON.stringify(settings) });
  assert.equal(loadSettings(), null);
  settings.progression = [];
  assert.equal(loadSettings()?.target, 'chord');
});

test('flat chord spellings preserve harmonic intervals', () => {
  assert.deepEqual(chordToneNames(makeChordDefinition('Bbmaj7', 'A#', 'major7')), ['B♭', 'D', 'F', 'A']);
  assert.deepEqual(chordToneNames(makeChordDefinition('F#maj7', 'F#', 'major7')), ['F♯', 'A♯', 'C♯', 'E♯']);
});

test('count-in stays visible through all four clicks and silence never affects the score', (t) => {
  const { conductor, judge, advance } = harness(t);
  conductor.play(); advance(1600);
  assert.equal(conductor.getSnapshot().transport, 'counting-in');
  assert.equal(conductor.getSnapshot().countInBeat, 4);
  advance(2100);
  assert.equal(conductor.getSnapshot().transport, 'playing');
  advance(10000);
  assert.equal(judge.getSnapshot().sessionTotal, 0);
});

test('Space and Escape reach the transport except where the focused control needs them', () => {
  const key = (code: string, tag: string, extra = {}) =>
    transportShortcut({ code, tag, repeat: false, hasModifier: false, editable: false, ...extra });
  assert.equal(key('Space', 'body'), 'toggle');
  assert.equal(key('Space', 'input', { inputType: 'range' }), 'toggle');
  assert.equal(key('Space', 'button'), null); // keyboard-focused button keeps native activation
  assert.equal(key('Space', 'select'), null);
  assert.equal(key('Space', 'body', { repeat: true }), null);
  assert.equal(key('Space', 'body', { hasModifier: true }), null);
  assert.equal(key('Escape', 'button'), 'stop');
  assert.equal(key('Escape', 'select'), null);
  assert.equal(key('Escape', 'input', { inputType: 'text' }), null);
});

test('detected notes are spelled the way the current chord spells them', (t) => {
  const { conductor, playback, judge, advance } = harness(t);
  playback.setProgression(buildExercise(10, 'ii-v-i')); // Cm7 F7 Bbmaj7
  conductor.play(); advance(2100);
  judge.submitNote(3);
  assert.equal(judge.getSnapshot().lastDetectedName, 'E♭');
  judge.submitNote(1);
  assert.equal(judge.getSnapshot().lastDetectedName, 'D♭');
  judge.submitNote(1);
  assert.deepEqual(judge.getSnapshot().outsideTargetLog, [{ pitchClass: 1, noteName: 'D♭', chordLabel: 'Cm7', count: 2 }]);
  assert.equal(spellPitchClass(10, makeChordDefinition('F#', 'F#', 'major')), 'A♯');
  assert.equal(formatChordLabel('Bbmaj7'), 'B♭maj7');
  assert.equal(formatChordLabel('F#m'), 'F♯m');
  assert.equal(formatChordLabel('Bm7'), 'Bm7');
});

test('an unedited preset is recognised with its key; edited progressions are not', () => {
  assert.deepEqual(matchExercise(buildExercise(5, 'turnaround')), { tonic: 5, kind: 'turnaround', movement: 'none' });
  assert.deepEqual(matchExercise(buildExercise(10, 'blues')), { tonic: 10, kind: 'blues', movement: 'none' });
  assert.equal(matchExercise(buildExercise(0, 'ii-v-i').slice(1)), null);
  assert.equal(matchExercise([]), null);
});

for (const bpm of [60, 120, 240]) {
  test(`resume count-in keeps beats aligned at ${bpm} BPM`, (t) => {
    const { conductor, advance } = harness(t);
    conductor.setBpm(bpm);
    conductor.play(); advance(20_000); conductor.pause(); advance(21_337);
    const beats: number[] = [];
    const bars: number[] = [];
    conductor.on('beat', (e) => beats.push(e.audioTime));
    conductor.on('bar', (e) => bars.push(e.audioTime));
    conductor.play(); advance(621_337);
    const interval = 60 / bpm;
    assert.ok(beats.length > 500);
    beats.forEach((time, i) => assert.ok(Math.abs(time - (21.337 + 0.05 + 4 * interval + i * interval)) < 1e-8));
    bars.forEach((time, i) => assert.equal(time, beats[i * 4]));
  });
}

test('a failed microphone switch falls back to the working device', async (t) => {
  const { replace } = harness(t);
  const stream = (id: string) => ({
    getTracks: () => [{ stop() {} }],
    getAudioTracks: () => [{ label: `Mic ${id}`, getSettings: () => ({ deviceId: id }), addEventListener() {} }],
  });
  // Like Safari: capture is refused unless the session allows recording when it is requested.
  const audioSession = { type: 'playback' };
  replace('navigator', { audioSession, mediaDevices: {
    getUserMedia: async ({ audio }: { audio: { deviceId?: { exact: string } } }) => {
      if (audioSession.type === 'playback') throw new DOMException('session is playback-only', 'InvalidStateError');
      const id = audio.deviceId?.exact ?? 'a';
      if (id === 'denied') throw new DOMException('denied', 'NotAllowedError');
      if (id === 'broken') throw new Error('NotReadableError');
      return stream(id);
    },
    enumerateDevices: async () => [{ kind: 'audioinput', deviceId: 'a', label: 'Mic a' }, { kind: 'audioinput', deviceId: 'broken', label: 'Mic broken' }],
  } });
  replace('AudioContext', class {
    sampleRate = 48000; state = 'running';
    resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
    createAnalyser() { return { fftSize: 0, getFloatTimeDomainData() {} }; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  });
  replace('requestAnimationFrame', () => 1); replace('cancelAnimationFrame', () => {});
  const mic = new MicInput(() => {}, new AudioHost());
  const statuses: string[] = [];
  mic.subscribe(() => { const { status } = mic.getSnapshot().connection; if (statuses.at(-1) !== status) statuses.push(status); });
  assert.equal(mic.getSnapshot().connection.status, 'idle');
  await mic.requestAccess();
  assert.deepEqual(statuses, ['requesting', 'connected']);
  assert.equal(deviceOf(mic.getSnapshot().connection)?.id, 'a');

  assert.equal(audioSession.type, 'auto');
  await mic.connect('broken');
  // The fallback is a connected state with a notice, not a failure.
  const restored = mic.getSnapshot().connection;
  assert.equal(restored.status, 'connected');
  assert.equal(deviceOf(restored)?.id, 'a');
  assert.match(restored.status === 'connected' ? restored.notice ?? '' : '', /Still using the previous one/);
  assert.equal(failureOf(restored), null);
  mic.disconnect();
  await mic.connect('broken'); // nothing to fall back to
  assert.equal(mic.getSnapshot().connection.status, 'failed');
  assert.match(failureOf(mic.getSnapshot().connection) ?? '', /access failed/);
  assert.equal(audioSession.type, 'playback'); // handed back to playback once the mic is closed
  await mic.connect('denied');
  assert.match(failureOf(mic.getSnapshot().connection) ?? '', /permission was blocked/);
  mic.disconnect();
  assert.equal(mic.getSnapshot().connection.status, 'idle');
  mic.dispose();
});

test('the audio host owns the session and keeps wanted output awake', (t) => {
  const { conductor, replace } = harness(t);
  const session = { type: 'auto' };
  replace('navigator', { audioSession: session });
  const host = new AudioHost();
  assert.equal(session.type, 'playback');
  // The session is 'auto' exactly while at least one capture is open.
  const first = host.beginCapture(); const second = host.beginCapture();
  assert.equal(session.type, 'auto');
  first(); first(); assert.equal(session.type, 'auto'); // releasing twice counts once
  second(); assert.equal(session.type, 'playback');
  replace('navigator', {});
  assert.doesNotThrow(() => new AudioHost().beginCapture()());

  // The conductor asks for output while the transport runs; the host resumes a parked context.
  let resumed = 0;
  Object.assign(conductor.audioContext, { state: 'interrupted', resume: () => { resumed++; return Promise.resolve(); } });
  conductor.play();
  assert.ok(resumed >= 1);
});

test('a first visit opens with a ii-V-I in C; a saved progression, even an empty one, is respected', (t) => {
  const { replace } = harness(t);
  replace('localStorage', { getItem: () => null });
  assert.deepEqual(startingProgression(loadSettings()).map((c) => c.label), ['Dm7', 'G7', 'Cmaj7']);
  const settings = { bpm: 120, barLength: 1, direction: 'clockwise', progression: [] as unknown[] };
  replace('localStorage', { getItem: () => JSON.stringify(settings) });
  assert.deepEqual(startingProgression(loadSettings()), []);
  settings.progression = [makeChordDefinition('F', 'F', 'major')];
  assert.deepEqual(startingProgression(loadSettings()).map((c) => c.label), ['F']);
});

test('a circle node toggles its chord: unlit adds, lit removes every chord it stands for', () => {
  const start = buildExercise(0, 'ii-v-i'); // Dm7 G7 Cmaj7
  const added = toggleCircleChord(start, 'F', 'F', 'major');
  assert.deepEqual(added.next.map((c) => c.label), ['Dm7', 'G7', 'Cmaj7', 'F']);
  assert.equal(added.removed.length, 0);
  const again = toggleCircleChord(added.next, 'F', 'F', 'major');
  assert.deepEqual(again.next.map((c) => c.label), ['Dm7', 'G7', 'Cmaj7']);
  // The Dm node stands for Dm7; tapping it removes the seventh chord, not a second Dm.
  const minor = toggleCircleChord(start, 'Dm', 'D', 'minor');
  assert.deepEqual(minor.next.map((c) => c.label), ['G7', 'Cmaj7']);
  assert.deepEqual(minor.removed.map((c) => c.label), ['Dm7']);
  // D major is a different node and is added alongside Dm7.
  assert.equal(toggleCircleChord(start, 'D', 'D', 'major').next.length, 4);
  const blues = toggleCircleChord(buildExercise(0, 'blues'), 'C', 'C', 'major');
  assert.equal(blues.removed.length, 7); // seven of the twelve bars are the I chord
  assert.ok(blues.next.every((c) => c.root !== 'C'));
});

test('select all lights every circle node once and keeps existing chords', () => {
  const start = buildExercise(0, 'ii-v-i'); // Dm7 G7 Cmaj7 already light Dm, G and C
  const all = selectAllCircleChords(start);
  assert.equal(all.length, 24);
  assert.deepEqual(all.slice(0, 3).map((c) => c.label), ['Dm7', 'G7', 'Cmaj7']);
  assert.equal(new Set(all.map((c) => `${c.root}:${c.quality.startsWith('minor')}`)).size, 24);
  assert.deepEqual(selectAllCircleChords(all), all);
  assert.equal(selectAllCircleChords([]).length, 24);
});

test('a preset moves through keys and is recognised with its movement', () => {
  const labels = (movement: Parameters<typeof buildExercise>[2]) => buildExercise(0, 'ii-v-i', movement).map((c) => c.label);
  assert.deepEqual(labels('fourths').slice(0, 9), ['Dm7', 'G7', 'Cmaj7', 'Gm7', 'C7', 'Fmaj7', 'Cm7', 'F7', 'Bbmaj7']);
  assert.equal(labels('fourths').length, 36);
  assert.deepEqual(labels('whole-down').slice(3, 6), ['Cm7', 'F7', 'Bbmaj7']);
  assert.deepEqual(labels('half-down').slice(3, 6), ['C#m7', 'F#7', 'Bmaj7']);
  assert.deepEqual(labels('minor-thirds').filter((_, i) => i % 3 === 2), ['Cmaj7', 'Ebmaj7', 'F#maj7', 'Amaj7']);
  assert.deepEqual(buildExercise(0, 'ii-v-i', 'none'), buildExercise(0, 'ii-v-i'));
  for (const movement of KEY_MOVEMENT_KINDS) {
    for (const kind of EXERCISE_KINDS) {
      assert.deepEqual(matchExercise(buildExercise(7, kind, movement)), { tonic: 7, kind, movement });
    }
  }
});

test('the key label follows the cycle and stays off for one-key and custom progressions', () => {
  const cycle = buildExercise(0, 'ii-v-i', 'fourths');
  assert.deepEqual(keyAt(cycle, 0), { name: 'C', pass: 1, passes: 12 });
  assert.deepEqual(keyAt(cycle, 5), { name: 'F', pass: 2, passes: 12 });
  assert.deepEqual(keyAt(cycle, 8), { name: 'B♭', pass: 3, passes: 12 });
  assert.equal(keyAt(cycle, 36), null);
  assert.deepEqual(keyAt(buildExercise(1, 'blues-minor', 'minor-thirds'), 0), { name: 'C♯m', pass: 1, passes: 4 });
  assert.equal(keyAt(buildExercise(0, 'ii-v-i'), 0), null);
  assert.equal(keyAt(cycle.slice(1), 0), null);
});

test('random order in a key cycle keeps each ii–V–I whole and jumps to a different key', (t) => {
  const { conductor, playback, advance } = harness(t);
  playback.setProgression(buildExercise(0, 'ii-v-i', 'fourths'));
  playback.setPlaybackMode('random');
  conductor.play();
  const played: number[] = [];
  for (let bar = 0; bar < 30; bar++) {
    advance(2100 + bar * 2000);
    played.push(playback.getSnapshot().chordIndex);
  }
  assert.equal(played[0], 0); // starts on the ii of the chosen key
  for (let i = 0; i < played.length; i += 3) {
    const start = played[i];
    assert.equal(start % 3, 0);
    assert.deepEqual(played.slice(i, i + 3), [start, start + 1, start + 2]);
    if (i > 0) assert.notEqual(start, played[i - 3]);
  }
  // Inside a phrase the next chord is known; at its end the next key is not.
  assert.equal(playback.getSnapshot().nextChord, null);
  // Single-chord shuffling is unchanged for one-key presets.
  playback.setProgression(buildExercise(0, 'blues'));
  playback.setPlaybackMode('random');
  conductor.play();
  advance(200_000); advance(202_100);
  assert.equal(playback.getSnapshot().nextChord, null);
});

test('blues presets spell the expected changes and every preset is recognised in every key', () => {
  const labels = (kind: Parameters<typeof buildExercise>[1], tonic = 0) => buildExercise(tonic as 0, kind).map((c) => c.label);
  assert.deepEqual(labels('blues-quick'), ['C7', 'F7', 'C7', 'C7', 'F7', 'F7', 'C7', 'C7', 'G7', 'F7', 'C7', 'G7']);
  assert.deepEqual(labels('blues-jazz', 5), ['F7', 'Bb7', 'F7', 'F7', 'Bb7', 'Bb7', 'F7', 'D7', 'Gm7', 'C7', 'F7', 'C7']);
  assert.deepEqual(labels('blues-minor'), ['Cm7', 'Cm7', 'Cm7', 'Cm7', 'Fm7', 'Fm7', 'Cm7', 'Cm7', 'Ab7', 'G7', 'Cm7', 'G7']);
  assert.deepEqual(labels('blues-i-iv'), ['C7', 'F7']);
  assert.deepEqual(labels('blues-v-iv-i'), ['G7', 'F7', 'C7']);
  assert.deepEqual(labels('blues-i-v', 7), ['G7', 'D7']);
  // No two preset-and-key pairs produce the same progression, so the active preset is never misreported.
  for (const kind of EXERCISE_KINDS) {
    for (let tonic = 0; tonic < 12; tonic++) {
      assert.deepEqual(matchExercise(buildExercise(tonic as 0, kind)), { tonic, kind, movement: 'none' });
    }
  }
});

test('the transport only makes legal moves, and each state maps to one take phase', (t) => {
  const { conductor, playback, judge, advance } = harness(t);
  const seen: TransportState[] = [];
  conductor.on('transport', (e) => seen.push(e.state));
  conductor.pause(); conductor.stop();          // ignored while stopped
  conductor.play(); conductor.play();           // second play is ignored
  advance(2100); conductor.pause(); conductor.pause();
  conductor.play(); advance(2200); conductor.pause(); // pause during the count back in
  conductor.play(); advance(4400);
  conductor.stop(); conductor.play(); conductor.stop(); // stop during a fresh count-in
  assert.deepEqual(seen, ['counting-in', 'playing', 'paused', 'counting-back', 'paused', 'counting-back', 'playing', 'stopped', 'counting-in', 'stopped']);
  seen.reduce((from, to) => { assert.ok(canTransition(from, to), `${from} -> ${to}`); return to; }, 'stopped' as TransportState);
  // Every state is reachable and no state is a dead end.
  const states = Object.keys(TRANSPORT_TRANSITIONS) as TransportState[];
  for (const state of states) {
    assert.ok(TRANSPORT_TRANSITIONS[state].length > 0);
    assert.ok(states.some((from) => canTransition(from, state)));
  }
  assert.deepEqual(states.map((state) => [state, takePhase(state)]), [
    ['stopped', 'over'], ['counting-in', 'new'], ['playing', 'live'], ['paused', 'held'], ['counting-back', 'held'],
  ]);
  assert.equal(playback.getSnapshot().isActive, false);
  assert.equal(judge.getSnapshot().isActive, false);
});

test('home-screen height corrects a status-bar-sized shortfall and nothing else', () => {
  assert.equal(homeScreenHeight(402, 874, 402, 812), 874); // portrait, 62pt short
  assert.equal(homeScreenHeight(402, 874, 874, 340), 402); // landscape, 62pt short
  assert.equal(homeScreenHeight(402, 874, 402, 874), null); // already full height
  assert.equal(homeScreenHeight(1024, 1366, 507, 1366), null); // iPad split view, full height
  assert.equal(homeScreenHeight(1024, 1366, 768, 1100), null); // much smaller window: real, not the bug
});
