import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { EXERCISE_KINDS, buildExercise, formatChordLabel, matchExercise } from '../../engine/chordData';
import type { ExerciseKind } from '../../engine/chordData';
import type { PitchClass } from '../../engine/chordData.types';
import { PC_TO_NOTE_NAME } from '../../engine/scaleData';
import { useJudge } from '../../engine/useJudge';
import type { PracticeTarget } from '../../engine/judge.types';
import { useConductor } from '../../audio/useConductor';
import { usePlaybackEngine } from '../../audio/usePlaybackEngine';
import { TONE_TYPES } from '../../audio/playbackEngine.types';
import type { PlaybackDirection, PlaybackMode } from '../../audio/playbackEngine.types';
import InputSetup from './InputSetup';
import { useProgressionEdits } from '../useProgressionEdits';
import AudioDebug from './AudioDebug';
import { TARGET_NAMES } from '../labels';
import { Button, IconButton, SectionHeading, Segmented, Select } from '../primitives';

const PRESET_NAMES: Record<ExerciseKind, string> = {
  'ii-v-i': 'ii–V–I',
  turnaround: 'I–vi–ii–V',
  blues: '12-bar blues',
};

const PITCH_CLASSES = Object.keys(PC_TO_NOTE_NAME).map(Number) as PitchClass[];

const PRESET_OPTIONS = EXERCISE_KINDS.map((kind) => ({ value: kind, label: PRESET_NAMES[kind] }));
const KEY_OPTIONS = PITCH_CLASSES.map((pc) => ({ value: pc, label: PC_TO_NOTE_NAME[pc] }));
const TARGET_OPTIONS = (Object.keys(TARGET_NAMES) as PracticeTarget[]).map((value) => ({ value, label: TARGET_NAMES[value] }));
const SHOW_DEBUG = new URLSearchParams(window.location.search).has('debug');
const BAR_OPTIONS = ([1, 2, 3, 4] as const).map((n) => ({ value: n, label: String(n) }));
const MODE_OPTIONS: { value: PlaybackMode; label: string }[] = [
  { value: 'sequential', label: 'In order' },
  { value: 'random', label: 'Random' },
];
const DIRECTION_OPTIONS: { value: PlaybackDirection; label: string }[] = [
  { value: 'clockwise', label: 'Forward' },
  { value: 'counter', label: 'Reverse' },
];

export default function SetupPanel() {
  const [manualTonic, setManualTonic] = useState<PitchClass>(0);
  const { undo, replaceProgression, applyUndo } = useProgressionEdits();
  const [isOpen, setIsOpen] = useState(true);
  const { target, setTarget } = useJudge();
  const { transport, config, setBarLength } = useConductor();
  const {
    setProgression,
    direction,
    setDirection,
    playbackMode,
    setPlaybackMode,
    progression,
    chordIndex,
    toneType,
    setToneType,
  } = usePlaybackEngine();

  // The key and active preset are read from the progression itself, so they stay
  // correct after a reload and stop claiming a preset once it has been edited.
  const preset = useMemo(() => matchExercise(progression), [progression]);
  const tonic = preset?.tonic ?? manualTonic;
  const activeIndex = transport === 'stopped' ? -1 : chordIndex;

  function loadPreset(kind: ExerciseKind) {
    if (preset?.kind === kind) return;
    replaceProgression(buildExercise(tonic, kind), 'Progression replaced.');
    setPlaybackMode('sequential');
    setDirection('clockwise');
  }

  function changeKey(next: PitchClass) {
    setManualTonic(next);
    if (preset) setProgression(buildExercise(next, preset.kind));
  }

  const isRunning = transport === 'playing' || transport === 'counting';

  return (
    <aside
      aria-label="Set up"
      className={`zone-setup scroll-cue flex flex-col border-border-muted lg:border-r ${isOpen ? 'lg:w-72' : ''}`}
    >
      <div className={`flex items-center justify-between gap-2 py-4 ${isOpen ? '' : 'lg:flex-col'}`}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-lg text-primary" aria-hidden="true">adjust</span>
          <h1 className={`text-lg font-bold ${isOpen ? '' : 'lg:hidden'}`}>CircleSense</h1>
        </div>
        <IconButton
          icon={isOpen ? 'chevron_left' : 'tune'}
          label={isOpen ? 'Hide setup' : 'Show setup'}
          aria-expanded={isOpen}
          className="max-lg:hidden"
          onClick={() => setIsOpen(!isOpen)}
        />
      </div>

      {/* Collapsing is a desktop affordance; on phones the tabs decide what shows. */}
      {(
        <div className={`flex flex-col gap-5 pb-4 ${isOpen ? '' : 'lg:hidden'}`}>
          <section className="space-y-2">
            <div className="flex min-h-8 items-center justify-between">
              <SectionHeading>Progression ({progression.length})</SectionHeading>
              {progression.length > 0 && (
                <Button variant="danger" onClick={() => replaceProgression([], 'Progression cleared.')}>Clear</Button>
              )}
            </div>
            <Select label="Key" showLabel options={KEY_OPTIONS} value={tonic} onChange={(v) => changeKey(Number(v) as PitchClass)} />
            <Segmented label="Preset" options={PRESET_OPTIONS} value={preset?.kind ?? null} onChange={loadPreset} />
            <div className="flex flex-wrap gap-1.5 min-h-12 bg-surface/50 border border-border-muted rounded-lg p-2">
              {progression.length === 0 ? (
                <span className="text-xs text-ink-muted">Load a preset, or tap chords on the circle.</span>
              ) : (
                progression.map((chord, idx) => (
                  <div
                    key={`${chord.label}-${idx}`}
                    aria-current={idx === activeIndex ? 'step' : undefined}
                    className={`flex items-center pl-2 rounded-lg border border-border-muted bg-surface text-xs font-bold text-ink ${
                      idx === activeIndex ? 'outline outline-2 outline-ink' : ''
                    }`}
                  >
                    <span>{formatChordLabel(chord.label)}</span>
                    <button
                      className="size-8 pointer-coarse:size-11 flex items-center justify-center text-ink-muted hover:text-ink transition-colors"
                      aria-label={`Remove ${formatChordLabel(chord.label)} at position ${idx + 1}`}
                      onClick={() => replaceProgression(progression.filter((_, i) => i !== idx), 'Chord removed.')}
                    >
                      &times;
                    </button>
                  </div>
                ))
              )}
            </div>
            {undo && (
              <p role="status" className="text-xs text-ink">
                {undo.message} <Button variant="quiet" onClick={applyUndo}>Undo</Button>
              </p>
            )}
            <Field label="Chord order">
              <Segmented label="Chord order" options={MODE_OPTIONS} value={playbackMode} onChange={setPlaybackMode} />
            </Field>
            {playbackMode === 'sequential' && (
              <Field label="Direction">
                <Segmented label="Direction" options={DIRECTION_OPTIONS} value={direction} onChange={setDirection} />
              </Field>
            )}
            <Field label="Bars per chord">
              <Segmented
                label="Bars per chord"
                options={BAR_OPTIONS}
                value={config.barLength}
                onChange={setBarLength}
                disabled={isRunning}
                disabledHint="Pause to change bars per chord"
              />
            </Field>
          </section>

          <section className="space-y-2">
            <SectionHeading>Target</SectionHeading>
            <Select label="Practice target" className="w-full" options={TARGET_OPTIONS} value={target} onChange={(v) => setTarget(v as PracticeTarget)} />
          </section>

          <InputSetup />
          {SHOW_DEBUG && <AudioDebug />}

          <section className="space-y-2">
            <SectionHeading>Chord sound</SectionHeading>
            <Segmented label="Chord sound" options={TONE_TYPES} value={toneType} onChange={setToneType} />
            {isRunning && <p className="text-xs text-ink-muted">Changes from the next chord.</p>}
          </section>

          <details className="text-xs text-ink-muted">
            <summary className="min-h-8 pointer-coarse:min-h-11 py-2 cursor-pointer font-bold text-ink">How practice works</summary>
            <ul className="space-y-2 list-disc pl-4">
              <li>Aim for the green tones. Other notes are outside target for this exercise, not musical mistakes.</li>
              <li>Triads have no 7th, so guide tones on a triad means the 3rd only.</li>
              <li>Space plays or pauses. Esc stops.</li>
              <li>Pause to change tempo or bars per chord. Resume counts you back in at the start of the current chord.</li>
              <li>Changing the target, the input, or pressing play after a stop starts a new take. The one before stays visible as “Previous take”.</li>
              <li>Tap a chord on the circle to add it; tap a lit chord to remove it. Editing stops playback, and the circle is locked while chords are playing.</li>
            </ul>
          </details>
        </div>
      )}
    </aside>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <span className="shrink-0 text-xs text-ink-muted">{label}</span>
      {children}
    </div>
  );
}
