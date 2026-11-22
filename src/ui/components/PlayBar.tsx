import { useMemo } from 'react';
import { useConductor } from '../../audio/useConductor';
import { usePlaybackEngine } from '../../audio/usePlaybackEngine';
import { useJudge } from '../../engine/useJudge';
import { buildVoicing, chordToneNames, formatChordLabel, spellPitchClass } from '../../engine/chordData';
import { useMidiInput } from '../../input/useMidiInput';
import { useMicInput } from '../../input/useMicInput';
import { useTransportShortcuts } from '../useTransportShortcuts';
import { IconButton } from '../primitives';

const microLabel = 'text-label font-bold uppercase tracking-widest text-ink-muted';
const DEGREES = ['R', '3rd', '5th', '7th'];

/**
 * Everything needed while playing, in one glance: transport, tempo, the current
 * chord and its tones. Pinned to the viewport on small screens.
 */
export default function PlayBar() {
  const { transport, config, play, pause, stop, setBpm } = useConductor();
  const { progression, currentChord, nextChord, playbackMode } = usePlaybackEngine();
  const { lastDetectedName, lastDetectedNote, isTargetHit, isActive, target } = useJudge();
  const midiNote = useMidiInput().lastNote;
  const micNote = useMicInput().lastNote;

  const isPlaying = transport === 'playing';
  const isCounting = transport === 'counting';
  const isRunning = isPlaying || isCounting;
  const isPaused = transport === 'paused';
  const isEmpty = progression.length === 0;
  const playLabel = isEmpty
    ? 'Add a chord or load a preset to start'
    : isRunning ? 'Pause' : isPaused ? 'Resume current chord' : 'Start practice';

  useTransportShortcuts({ canToggle: !isEmpty, onToggle: isRunning ? pause : play, onStop: stop });

  const chordTones = useMemo(() => {
    if (!currentChord) return [];
    const names = chordToneNames(currentChord);
    return buildVoicing(currentChord.rootPitchClass, currentChord.quality).pitchClasses.map((pc, i) => ({
      pitchClass: pc,
      note: names[i],
      degree: DEGREES[i] ?? '',
      isTarget: target === 'chord' || i === 1 || (target === 'guide' && i === 3),
    }));
  }, [currentChord, target]);

  // "Heard" is the one live readout of the incoming note. While chords play it carries the
  // verdict; otherwise it shows the raw input, which doubles as the signal check.
  const hasDetection = isActive && lastDetectedNote !== null;
  const inputNote = midiNote ?? micNote;
  const heardName = hasDetection
    ? lastDetectedName
    : inputNote ? spellPitchClass(inputNote.pitchClass, currentChord) : null;
  const heardStyle = hasDetection
    ? (isTargetHit ? 'border-primary text-primary bg-primary/10' : 'border-ink text-ink')
    : heardName ? 'border-ink-muted text-ink' : 'border-ink-muted/40 text-ink-muted';
  const heardVerdict = hasDetection ? (isTargetHit ? 'on target' : 'outside target') : '';

  return (
    <section
      aria-label="Play"
      className="sticky top-0 bottom-0 z-40 flex flex-col gap-2 border-y border-border-muted bg-surface px-4 py-2 lg:static lg:col-start-2 lg:row-start-1 lg:border-t-0"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <IconButton
            icon={isRunning ? 'pause' : 'play_arrow'}
            label={playLabel}
            title={`${playLabel} (Space)`}
            disabled={isEmpty}
            onClick={isRunning ? pause : play}
          />
          <IconButton icon="stop" label="Stop and keep results" title="Stop and keep results (Esc)" onClick={stop} />
          <span role="status" className={`${microLabel} flex items-center gap-2`}>
            {isCounting && <span className="size-2 rounded-full bg-yellow-400 animate-pulse" />}
            {isPlaying && <span className="size-2 rounded-full bg-ink animate-pulse" />}
            {isPaused && <span className="size-2 rounded-full bg-yellow-400" />}
            {isEmpty ? 'No chords yet' : transport}
          </span>
        </div>

        <label className="flex basis-full items-center gap-2 sm:basis-40 sm:flex-1">
          <span className={microLabel}>Tempo</span>
          <input
            className="h-8 pointer-coarse:h-11 min-w-0 flex-1 cursor-pointer accent-ink"
            disabled={isRunning}
            title={isRunning ? 'Pause to change tempo' : undefined}
            max={240}
            min={40}
            step={1}
            type="range"
            value={config.bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
          <span className="w-16 text-right text-xs font-bold text-ink">{config.bpm} BPM</span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex min-w-20 flex-col">
          <span className="text-lg font-bold leading-6 text-ink">{currentChord ? formatChordLabel(currentChord.label) : '--'}</span>
          <span className="text-xs text-ink-muted">
            Next: {playbackMode === 'random' ? 'random' : nextChord ? formatChordLabel(nextChord.label) : '—'}
          </span>
        </div>

        {chordTones.length === 0 ? (
          <span className="text-xs text-ink-muted">Load a preset or add chords in Set up.</span>
        ) : (
          <ul aria-label="Chord tones" className="flex items-center gap-2">
            {chordTones.map(({ pitchClass, note, degree, isTarget }) => {
              const isDetected = hasDetection && lastDetectedNote === pitchClass;
              return (
                <li key={degree} className="flex flex-col items-center" aria-label={`${degree}: ${note}${isTarget ? ', target' : ''}`}>
                  <span className={microLabel}>{degree}</span>
                  <div
                    className={`size-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                      isDetected
                        ? (isTarget ? 'bg-primary text-background-dark' : 'bg-ink text-background-dark')
                        : isTarget
                          ? 'bg-primary/20 text-primary border-2 border-primary'
                          : 'bg-surface text-ink-muted border border-ink-muted/40'
                    }`}
                  >
                    {note}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="ml-auto flex flex-col items-center">
          <span className={microLabel}>Heard</span>
          <div
            aria-label={heardName ? `Heard ${heardName}${heardVerdict ? `, ${heardVerdict}` : ''}` : 'No note heard'}
            className={`size-10 rounded-full border-2 flex items-center justify-center font-bold text-sm ${heardStyle}`}
          >
            {heardName ?? '--'}
          </div>
        </div>
      </div>
    </section>
  );
}
