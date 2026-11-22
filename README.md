# CircleSense

Practice hearing and targeting chord tones through a progression. CircleSense is a local browser app built with React, TypeScript and Web Audio. Audio and microphone processing stay in the browser; there is no server or account.

## Practice

The screen has three zones in task order: **set up** on the left (progression, target, input, sound), **play** in the centre (transport, tempo, current chord tones, circle) and **results** on the right.

1. Select a key and load **ii–V–I**, **I–vi–ii–V**, or **12-bar blues**. Presets replace the progression and restore forward, in-order playback. Changing the key transposes a loaded preset. Alternatively, click the circle to build a sequence of major/minor triads. Replacing, clearing or removing chords offers **Undo** until the next edit.
2. Choose **All chord tones**, **3rd only**, or **Guide tones (3rd and 7th)**. Triads have no seventh, so their guide-tone target is the third only.
3. Under **Input** in the setup panel, connect MIDI or a microphone, choose your device, and play a note: it appears under **Heard** in the play bar, which is the one live readout of what the app hears. Switching source keeps the working input until the new one connects. You can also listen without connecting an input; the results panel says so.
4. Set tempo and bars per chord, then start. Four clicks count you in. The play bar shows the current chord, its tones and the next chord, and stays pinned on small screens. Target tones are green, the only use of green besides notes on target; the progression list marks the chord being played. The circle is display-only while chords are playing. Random playback intentionally has no next-chord prediction. Tone changes apply to newly scheduled chords.
5. Pause to adjust tempo or bars. Resume counts you in again, then repeats the current chord from its beginning and retains your results. Stop retains the results for review. Starting from stopped, changing target, or switching input/device starts a new take; the take it replaces stays visible as **Previous take**. **Clear results** discards both. Editing a progression stops playback.

Space toggles play/pause and Escape stops, including after clicking a button with the mouse. A button reached with Tab keeps its normal Space activation, and open selectors keep both keys. All buttons and selectors are keyboard accessible.

## What the feedback means

The percentage is **notes on target / notes played** in the current take. “Outside target” means outside the selected exercise constraint, not a musically wrong note. Outside-target notes are listed with the chord they were played over, and notes are spelled the way the current chord spells them. Silence is unscored. This app does not evaluate phrase quality, rhythm, intonation, or chromatic resolution. Results remain visible after stopping, but are not saved across page reloads. Practice settings and progressions are saved locally.

MIDI counts each note-on once. Microphone input is monophonic: a pitch must remain stable for 80 ms before it counts; sustained notes count once, and 120 ms of silence rearms the same pitch. Fast notes and repeated articulations without a gap may be missed. MIDI and microphone results are useful within their own practice sessions, not interchangeable measurements. The mic confidence threshold remains 0.9 and RMS silence gate remains 0.01. Use headphones so accompaniment does not enter the microphone. Browser/device latency is not calibrated; scoring uses the chord audible at detection time.

Microphone access requires HTTPS or localhost. MIDI availability depends on browser support and permissions. Permission failures are shown in input setup.

## Development

Use Node 22.13+ (22 LTS) and npm:

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
```

Vite serves `/circlesense/`. If an existing installation lacks a platform-specific Rollup package after changing machines/architectures, run `npm install` to restore optional dependencies. No lockfile deletion is required.

`npm test` bundles the TypeScript tests with esbuild and runs Node's test runner. Tests exercise the real conductor, playback and judge with deterministic browser clock/audio substitutes, including ten simulated minutes at 60/120/240 BPM, chord boundaries, pause/resume, count-in, multi-bar chords, target scoring, MIDI messages, mic gating, pitch detection and saved-setting validation. These tests verify scheduling and logic, not physical audio output or real microphone accuracy. Deployment runs lint, tests and build before uploading to GitHub Pages.

## Architecture

- `src/audio/conductor.ts`: authoritative Web Audio clock and lookahead scheduling.
- `src/audio/playbackEngine.ts`: scheduled chord synthesis and an audible-time chord timeline. Display snapshots update when the audio boundary arrives.
- `src/engine/judge.ts`: scores observations against the audible chord and selected target; retains stopped/paused session results.
- `src/input/`: isolated MIDI, monophonic pitch detection and stable-note gating.
- `src/state/`: validated local settings persistence.
- `src/ui/components/`: setup panel, play bar, circle, results and device setup. `src/ui/primitives.tsx` holds the shared button, segmented control, select and heading; `src/index.css` holds the colour and type tokens.

Before release, verify real audio at the required tempos, MIDI with a physical keyboard, microphone silence and sustained notes with headphones, permission denial/reconnection, and target feedback at chord changes. Automated tests do not replace those hardware checks.
