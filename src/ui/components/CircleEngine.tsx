import { useConductor } from '../../audio/useConductor';
import { usePlaybackEngine } from '../../audio/usePlaybackEngine';
import { CIRCLE_MAJOR, CIRCLE_MINOR, formatChordLabel, matchesCircleEntry, toggleCircleChord } from '../../engine/chordData';
import { useProgressionEdits } from '../useProgressionEdits';
import { Button } from '../primitives';
import type { ChordQuality, NoteName } from '../../engine/chordData.types';

// Outer ring is major, inner ring is relative minor. Radius is a percentage of the disc;
// quality is carried by ring and label, not colour.
const RINGS = [
  // Sized so both rings stay tappable on a phone-width disc without touching each other.
  { entries: CIRCLE_MAJOR, radius: 42, size: 'size-[12.5cqw] text-lg' },
  { entries: CIRCLE_MINOR, radius: 28, size: 'size-[max(11.5cqw,2rem)] text-xs' },
];

export default function CircleEngine() {
  const { position, config, transport, countInBeat } = useConductor();
  const { currentChord, progression, chordIndex } = usePlaybackEngine();
  const { undo, replaceProgression, applyUndo } = useProgressionEdits();
  const isPlaying = transport === 'playing';
  const isCounting = transport === 'counting';

  const activeRoot = isPlaying ? currentChord?.root : null;
  const activeQuality = isPlaying ? currentChord?.quality : null;

  // Editing stops playback, so the circle is display-only while the transport runs.
  const locked = isPlaying || isCounting;
  const interactive = locked ? 'cursor-default' : 'cursor-pointer hover:scale-105';

  function handleChordClick(displayName: string, root: NoteName, quality: ChordQuality) {
    if (locked) return;
    // A node is a toggle: lit means "in the progression", so tapping it takes the chord out.
    const { next, removed } = toggleCircleChord(progression, displayName, root, quality);
    if (removed.length === 0) {
      replaceProgression(next, `Added ${formatChordLabel(displayName)}.`);
    } else {
      const names = [...new Set(removed.map((chord) => formatChordLabel(chord.label)))].join(', ');
      replaceProgression(next, `Removed ${names}${removed.length > 1 ? ` (${removed.length} chords)` : ''}.`);
    }
  }

  function isInProgression(root: NoteName, quality: ChordQuality): boolean {
    return progression.some((chord) => matchesCircleEntry(chord, root, quality));
  }

  function isActiveChord(root: NoteName, quality: ChordQuality): boolean {
    return root === activeRoot && !!(quality === 'minor' ? activeQuality?.startsWith('minor') : activeQuality && !activeQuality.startsWith('minor'));
  }

  return (
    <div className="zone-circle flex flex-col">
      <div className="circle-stage relative m-3 flex min-h-0 flex-1 items-center justify-center">
      {/* The Circle — aspect-ratio locked, scales to fit */}
      <div
        className="circle-disc relative aspect-square rounded-full border border-border-muted/30 flex items-center justify-center"
        style={{ containerType: 'inline-size' }}
      >

        {RINGS.map(({ entries, radius, size }) => entries.map((entry, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const active = isActiveChord(entry.root, entry.quality);
          const inProg = isInProgression(entry.root, entry.quality);

          return (
            <button
              key={entry.displayName}
              className={`absolute flex items-center justify-center rounded-full font-bold transition-all duration-200 ${interactive} ${size} ${
                active
                  ? 'bg-ink border-2 border-ink text-background-dark scale-110 z-10'
                  : inProg
                    ? 'bg-surface border-2 border-ink-muted text-ink'
                    : 'bg-surface border border-border-muted text-ink-muted hover:border-ink-muted hover:text-ink'
              }`}
              style={{
                left: `${50 + Math.cos(angle) * radius}%`,
                top: `${50 + Math.sin(angle) * radius}%`,
                transform: 'translate(-50%, -50%)',
              }}
              aria-disabled={locked}
              aria-pressed={inProg}
              aria-current={active ? 'true' : undefined}
              title={locked ? 'Pause or stop to edit the progression' : `${inProg ? 'Remove' : 'Add'} ${formatChordLabel(entry.displayName)} ${inProg ? 'from' : 'to'} the progression`}
              onClick={() => handleChordClick(entry.displayName, entry.root, entry.quality)}
            >
              {formatChordLabel(entry.displayName)}
            </button>
          );
        }))}

        {/* Central HUD — Beat Indicator */}
        <div className="flex items-center justify-center gap-2">
          {isCounting ? (
            Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className={`size-3.5 rounded-full transition-all duration-100 ${
                  i < countInBeat
                    ? 'bg-yellow-400'
                    : 'bg-surface border border-border-muted'
                }`}
              />
            ))
          ) : (
            Array.from({ length: config.beatsPerBar }, (_, i) => (
              <div
                key={i}
                className={`size-3.5 rounded-full transition-all duration-100 ${
                  i === position.beat && isPlaying
                    ? 'bg-ink scale-125'
                    : 'bg-surface border border-border-muted'
                }`}
              />
            ))
          )}
        </div>
      </div>
      </div>

      {/* Phones show one zone at a time, so the progression and the result of each tap are spelled out here. */}
      <div className="space-y-1 px-4 pb-2 text-xs lg:hidden">
        <p className="text-ink-muted">
          {progression.length === 0
            ? 'No chords yet.'
            : progression.map((chord, i) => (
              <span key={`${chord.label}-${i}`}>
                {i > 0 && ' → '}
                <span className={transport !== 'stopped' && i === chordIndex ? 'font-bold text-ink underline' : 'text-ink'}>{formatChordLabel(chord.label)}</span>
              </span>
            ))}
        </p>
        <p role="status" className="flex min-h-8 items-center gap-1 text-ink-muted pointer-coarse:min-h-11">
          {undo
            ? <><span className="text-ink">{undo.message}</span> <Button variant="quiet" onClick={applyUndo}>Undo</Button></>
            : locked ? 'Pause or stop to edit the chords.' : 'Tap a chord to add it. Tap a lit chord to remove it.'}
        </p>
      </div>
    </div>
  );
}
