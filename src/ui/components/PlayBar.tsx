import { useMemo } from 'react';
import { useConductor } from '../../audio/useConductor';
import { usePlaybackEngine } from '../../audio/usePlaybackEngine';
import { useJudge } from '../../engine/useJudge';
import { buildVoicing, chordToneNames, formatChordLabel, spellPitchClass } from '../../engine/chordData';
import { useMidiInput } from '../../input/useMidiInput';
import { useMicInput } from '../../input/useMicInput';
import { useTransportShortcuts } from '../useTransportShortcuts';
import { useWakeLock } from '../useWakeLock';
import { IconButton } from '../primitives';

const microLabel = 'text-label font-bold uppercase tracking-widest text-ink-muted';
const DEGREES = ['R', '3rd', '5th', '7th'];
const MIN_BPM = 40;
const MAX_BPM = 240;
// Tone tiles and the Heard badge: large on phones (shrinking on very narrow ones), compact on desktop.
const tile = 'flex items-center justify-center font-bold size-[min(3.5rem,15vw)] text-lg lg:size-10 lg:text-sm';

/**
 * Everything needed while playing: the current chord and its tones, and the transport.
 * Two sections so the shell can put the chord on top and the transport in thumb reach on phones.
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
  useWakeLock(isRunning);

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

  const tones = chordTones.length === 0 ? (
    <span className="text-xs text-ink-muted">Load a preset or add chords in Set up.</span>
  ) : (
    <ul aria-label="Chord tones" className="flex items-end gap-2">
      {chordTones.map(({ pitchClass, note, degree, isTarget }) => {
        const isDetected = hasDetection && lastDetectedNote === pitchClass;
        return (
          <li key={degree} className="flex flex-col items-center" aria-label={`${degree}: ${note}${isTarget ? ', target' : ''}`}>
            <span className={microLabel}>{degree}</span>
            <div
              className={`${tile} rounded-lg ${
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
  );

  return (
    <>
      {/* What to play now. Sized to be read at arm's length on a phone. */}
      <section aria-label="Now playing" className="zone-now flex flex-col gap-1 border-b border-border-muted bg-surface pb-2">
        <div className="flex items-baseline gap-3">
          <span className="text-display font-bold text-ink lg:text-lg">{currentChord ? formatChordLabel(currentChord.label) : '--'}</span>
          <span className="text-sm text-ink-muted lg:text-xs">
            Next: {playbackMode === 'random' ? 'random' : nextChord ? formatChordLabel(nextChord.label) : '—'}
          </span>
          <span role="status" className={`${microLabel} ml-auto flex items-center gap-2`}>
            {isCounting && <span className="size-2 rounded-full bg-yellow-400 animate-pulse" />}
            {isPlaying && <span className="size-2 rounded-full bg-ink animate-pulse" />}
            {isPaused && <span className="size-2 rounded-full bg-yellow-400" />}
            {isEmpty ? 'No chords yet' : transport}
          </span>
        </div>
        <div className="flex items-end gap-3">
          {tones}
          <div className="ml-auto flex flex-col items-center">
            <span className={microLabel}>Heard</span>
            <div
              aria-label={heardName ? `Heard ${heardName}${heardVerdict ? `, ${heardVerdict}` : ''}` : 'No note heard'}
              className={`${tile} rounded-full border-2 ${heardStyle}`}
            >
              {heardName ?? '--'}
            </div>
          </div>
        </div>
      </section>

      {/* Transport. On a phone the main button is wide and sits under the thumb. */}
      <section aria-label="Transport" className="zone-transport flex flex-col gap-2 border-t border-border-muted bg-surface py-2 lg:flex-row lg:items-center lg:gap-4 lg:border-t-0">
        <div className="flex items-center gap-2 lg:order-2 lg:flex-1">
          <span className={`${microLabel} max-lg:sr-only`} id="tempo-label">Tempo</span>
          <IconButton icon="remove" label="Slower" disabled={isRunning || config.bpm <= MIN_BPM} onClick={() => setBpm(config.bpm - 1)} />
          <input
            aria-labelledby="tempo-label"
            className="h-8 pointer-coarse:h-11 min-w-0 flex-1 cursor-pointer accent-ink"
            disabled={isRunning}
            title={isRunning ? 'Pause to change tempo' : undefined}
            max={MAX_BPM}
            min={MIN_BPM}
            step={1}
            type="range"
            value={config.bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
          <IconButton icon="add" label="Faster" disabled={isRunning || config.bpm >= MAX_BPM} onClick={() => setBpm(config.bpm + 1)} />
          <span className="w-16 text-right text-xs font-bold text-ink">{config.bpm} BPM</span>
        </div>

        <div className="flex items-center gap-2 lg:order-1">
          <button
            aria-label={playLabel}
            title={`${playLabel} (Space)`}
            disabled={isEmpty}
            className="flex min-h-12 flex-1 items-center justify-center gap-1 rounded-lg bg-ink text-sm font-bold text-background-dark transition-colors hover:bg-white lg:size-9 lg:min-h-0 lg:flex-none"
            onClick={isRunning ? pause : play}
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">{isRunning ? 'pause' : 'play_arrow'}</span>
            <span className="lg:hidden">{isEmpty ? 'Add chords to start' : isRunning ? 'Pause' : isPaused ? 'Resume' : 'Start'}</span>
          </button>
          <IconButton icon="stop" label="Stop and keep results" title="Stop and keep results (Esc)" className="max-lg:size-12" onClick={stop} />
        </div>
      </section>
    </>
  );
}
