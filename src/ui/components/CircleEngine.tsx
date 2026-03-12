import { useConductor } from '../../audio/useConductor';
import { usePlaybackEngine } from '../../audio/usePlaybackEngine';
import { CIRCLE_MAJOR, CIRCLE_MINOR, makeChordDefinition } from '../../engine/chordData';
import type { ChordQuality, NoteName } from '../../engine/chordData.types';

// Radii as percentage of the circle container size
const RADIUS_OUTER_PCT = 40; // % of container width/height
const RADIUS_INNER_PCT = 29;

export default function CircleEngine() {
  const { position, config, transport, countInBeat } = useConductor();
  const { currentChord, progression, addChord } = usePlaybackEngine();
  const isPlaying = transport === 'playing';
  const isCounting = transport === 'counting';

  const activeRoot = isPlaying ? currentChord?.root : null;
  const activeQuality = isPlaying ? currentChord?.quality : null;

  function handleChordClick(displayName: string, root: NoteName, quality: ChordQuality) {
    addChord(makeChordDefinition(displayName, root, quality));
  }

  function isInProgression(root: NoteName, quality: ChordQuality): boolean {
    return progression.some((c) => c.root === root && c.quality === quality);
  }

  function isActiveChord(root: NoteName, quality: ChordQuality): boolean {
    return root === activeRoot && quality === activeQuality;
  }

  return (
    <div className="flex-1 relative flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent p-4">
      {/* The Circle — aspect-ratio locked, scales to fit */}
      <div
        className="relative aspect-square w-full rounded-full border border-border-muted/30 shadow-[0_0_50px_rgba(56,255,20,0.05)] flex items-center justify-center"
        style={{ maxHeight: 'calc(100vh - 12rem)', maxWidth: 'calc(100vh - 12rem)' }}
      >

        {/* Outer Ring — Major Chords */}
        {CIRCLE_MAJOR.map((entry, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const x = Math.cos(angle) * RADIUS_OUTER_PCT;
          const y = Math.sin(angle) * RADIUS_OUTER_PCT;
          const active = isActiveChord(entry.root, entry.quality);
          const inProg = isInProgression(entry.root, entry.quality);

          return (
            <button
              key={`major-${entry.displayName}`}
              className={`absolute flex items-center justify-center rounded-full font-bold text-lg transition-all duration-200 cursor-pointer hover:scale-105 ${
                active
                  ? 'size-[4.5rem] bg-primary/20 border-2 border-primary text-primary shadow-[0_0_20px_rgba(56,255,20,0.4)] scale-110 z-10'
                  : inProg
                    ? 'size-16 bg-primary/10 border-2 border-primary/50 text-primary/80'
                    : 'size-16 bg-surface border border-border-muted text-slate-400 hover:border-primary/30 hover:text-slate-300'
              }`}
              style={{
                left: `${50 + x}%`,
                top: `${50 + y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              onClick={() => handleChordClick(entry.displayName, entry.root, entry.quality)}
            >
              {entry.displayName}
            </button>
          );
        })}

        {/* Inner Ring — Minor Chords */}
        {CIRCLE_MINOR.map((entry, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const x = Math.cos(angle) * RADIUS_INNER_PCT;
          const y = Math.sin(angle) * RADIUS_INNER_PCT;
          const active = isActiveChord(entry.root, entry.quality);
          const inProg = isInProgression(entry.root, entry.quality);

          return (
            <button
              key={`minor-${entry.displayName}`}
              className={`absolute flex items-center justify-center rounded-full font-bold text-xs transition-all duration-200 cursor-pointer hover:scale-105 ${
                active
                  ? 'size-14 bg-blue-500/20 border-2 border-blue-400 text-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.4)] scale-110 z-10'
                  : inProg
                    ? 'size-12 bg-blue-500/10 border-2 border-blue-400/50 text-blue-400/80'
                    : 'size-12 bg-surface/80 border border-border-muted text-slate-500 hover:border-blue-400/30 hover:text-slate-400'
              }`}
              style={{
                left: `${50 + x}%`,
                top: `${50 + y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              onClick={() => handleChordClick(entry.displayName, entry.root, entry.quality)}
            >
              {entry.displayName}
            </button>
          );
        })}

        {/* Central HUD — Beat Indicator */}
        <div className="flex items-center justify-center gap-2">
          {isCounting ? (
            Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className={`size-3.5 rounded-full transition-all duration-100 ${
                  i < countInBeat
                    ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]'
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
                    ? 'bg-primary shadow-[0_0_10px_#38ff14] scale-125'
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
