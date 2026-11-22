import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { Conductor } from '../src/audio/conductor';
import { PlaybackEngine } from '../src/audio/playbackEngine';
import { Judge } from '../src/engine/judge';
import { buildExercise, matchExercise, buildVoicing, chordToneNames, formatChordLabel, makeChordDefinition, spellPitchClass } from '../src/engine/chordData';
import { NoteGate } from '../src/input/noteGate';
import { yinDetect, frequencyToPitchClass, computeRMS } from '../src/input/pitchDetector';
import { MidiInput } from '../src/input/midiInput';
import { MicInput } from '../src/input/micInput';
import { setAudioSession } from '../src/audio/audioSession';
import { loadSettings, startingProgression } from '../src/state/sessionStore';
import { transportShortcut } from '../src/ui/useTransportShortcuts';

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
  assert.equal(conductor.getSnapshot().transport, 'counting');
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
  for (let note = 0; note < 128; note++) {
    for (const [status, velocity] of [[0x90, 100], [0x90, 0], [0x80, 100]]) {
      const e = new Event('midimessage'); Object.assign(e, { data: [status, note, velocity] }); device.dispatchEvent(e);
    }
  }
  assert.deepEqual(notes, Array.from({ length: 128 }, (_, i) => i % 12));
  assert.equal(midi.getSnapshot().lastNote, null);
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
  assert.equal(conductor.getSnapshot().transport, 'counting');
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
  assert.deepEqual(matchExercise(buildExercise(5, 'turnaround')), { tonic: 5, kind: 'turnaround' });
  assert.deepEqual(matchExercise(buildExercise(10, 'blues')), { tonic: 10, kind: 'blues' });
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
      if (audioSession.type !== 'play-and-record') throw new DOMException('session is playback-only', 'InvalidStateError');
      const id = audio.deviceId?.exact ?? 'a';
      if (id === 'denied') throw new DOMException('denied', 'NotAllowedError');
      if (id === 'broken') throw new Error('NotReadableError');
      return stream(id);
    },
    enumerateDevices: async () => [{ kind: 'audioinput', deviceId: 'a', label: 'Mic a' }, { kind: 'audioinput', deviceId: 'broken', label: 'Mic broken' }],
  } });
  replace('AudioContext', class {
    sampleRate = 48000;
    resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
    createAnalyser() { return { fftSize: 0, getFloatTimeDomainData() {} }; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  });
  replace('requestAnimationFrame', () => 1); replace('cancelAnimationFrame', () => {});
  const mic = new MicInput(() => {});
  await mic.requestAccess();
  assert.equal(mic.getSnapshot().activeDevice?.id, 'a');
  assert.equal(audioSession.type, 'play-and-record');
  await mic.connect('broken');
  assert.equal(mic.getSnapshot().isConnected, true);
  assert.equal(mic.getSnapshot().activeDevice?.id, 'a');
  assert.match(mic.getSnapshot().error ?? '', /Still using the previous one/);
  mic.disconnect();
  await mic.connect('broken'); // nothing to fall back to
  assert.equal(mic.getSnapshot().isConnected, false);
  assert.match(mic.getSnapshot().error ?? '', /access failed/);
  assert.equal(audioSession.type, 'playback'); // handed back to playback once the mic is closed
  await mic.connect('denied');
  assert.match(mic.getSnapshot().error ?? '', /permission was blocked/);
  mic.dispose();
});

test('audio session is declared where supported and ignored elsewhere; play resumes an interrupted context', (t) => {
  const { conductor, replace } = harness(t);
  const session = { type: 'auto' };
  replace('navigator', { audioSession: session });
  setAudioSession('playback'); assert.equal(session.type, 'playback');
  setAudioSession('play-and-record'); assert.equal(session.type, 'play-and-record');
  replace('navigator', {});
  assert.doesNotThrow(() => setAudioSession('playback'));
  let resumed = 0;
  Object.assign(conductor.audioContext, { state: 'interrupted', resume: () => { resumed++; return Promise.resolve(); } });
  conductor.play();
  assert.equal(resumed, 1);
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
