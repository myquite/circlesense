import { useConductor } from '../../audio/useConductor';
import { usePlaybackEngine } from '../../audio/usePlaybackEngine';
import { CIRCLE_MAJOR, CIRCLE_MINOR, formatChordLabel, makeChordDefinition } from '../../engine/chordData';
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
  const { currentChord, progression, addChord } = usePlaybackEngine();
  const isPlaying = transport === 'playing';
  const isCounting = transport === 'counting';

  const activeRoot = isPlaying ? currentChord?.root : null;
  const activeQuality = isPlaying ? currentChord?.quality : null;

  // Editing stops playback, so the circle is display-only while the transport runs.
  const locked = isPlaying || isCounting;
  const interactive = locked ? 'cursor-default' : 'cursor-pointer hover:scale-105';

  function handleChordClick(displayName: string, root: NoteName, quality: ChordQuality) {
    if (locked) return;
    addChord(makeChordDefinition(displayName, root, quality));
  }

  function isInProgression(root: NoteName, quality: ChordQuality): boolean {
    return progression.some((c) => c.root === root && (quality === 'minor' ? c.quality.startsWith('minor') : !c.quality.startsWith('minor')));
  }

  function isActiveChord(root: NoteName, quality: ChordQuality): boolean {
    return root === activeRoot && !!(quality === 'minor' ? activeQuality?.startsWith('minor') : activeQuality && !activeQuality.startsWith('minor'));
  }

  return (
    <div className="zone-circle circle-stage relative flex flex-col items-center justify-center m-3">
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
              aria-current={active ? 'true' : undefined}
              title={locked ? 'Pause or stop to edit the progression' : `Add ${formatChordLabel(entry.displayName)} to the progression`}
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
  );
}
