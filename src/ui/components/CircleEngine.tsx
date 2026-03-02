import { useConductor } from '../../audio/useConductor';
import { usePlaybackEngine } from '../../audio/usePlaybackEngine';
import type { NoteName } from '../../engine/chordData.types';

/** Circle of Fifths in clockwise order, starting from C at top (12 o'clock) */
const CIRCLE_OF_FIFTHS: NoteName[] = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F',
];

const RADIUS = 190; // px from center to note node center

export default function CircleEngine() {
  const { position, config, transport } = useConductor();
  const { currentChord, direction, setDirection, progressionLabels } = usePlaybackEngine();
  const isPlaying = transport === 'playing';

  const activeRoot = isPlaying ? currentChord?.root : null;

  return (
    <div className="flex-1 relative flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent">
      {/* The Circle */}
      <div className="relative size-[430px] rounded-full border border-border-muted/30 shadow-[0_0_50px_rgba(56,255,20,0.05)] flex items-center justify-center">

        {/* Circle of Fifths Nodes */}
        {CIRCLE_OF_FIFTHS.map((note, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180); // 30° per note, -90 to start at top
          const x = Math.cos(angle) * RADIUS;
          const y = Math.sin(angle) * RADIUS;
          const isActive = note === activeRoot;
          const isInProgression = progressionLabels.some(
            (label) => label.startsWith(note) && (label.length === note.length || !/[A-G]/.test(label[note.length]))
          );

          return (
            <div
              key={note}
              className={`absolute flex items-center justify-center rounded-full font-bold text-sm transition-all duration-200 ${
                isActive
                  ? 'size-14 bg-primary/20 border-2 border-primary text-primary shadow-[0_0_20px_rgba(56,255,20,0.4)] scale-110 z-10'
                  : isInProgression
                    ? 'size-12 bg-primary/10 border border-primary/50 text-primary/80'
                    : 'size-12 bg-surface border border-border-muted text-slate-400'
              }`}
              style={{
                transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
                left: '50%',
                top: '50%',
              }}
            >
              {note}
            </div>
          );
        })}

        {/* Central HUD */}
        <div className="text-center space-y-4">
          <div className="text-slate-400 text-xs tracking-[0.2em] font-bold uppercase">Now Playing</div>
          <div className="text-7xl font-black text-white tracking-tighter">{currentChord?.label ?? '--'}</div>
          <div className="flex items-center justify-center gap-3">
            <div className="px-3 py-1 bg-surface border border-border-muted rounded text-sm font-mono">
              BAR {position.bar + 1}/{config.barLength}
            </div>
            <div className="flex gap-1">
              {Array.from({ length: config.beatsPerBar }, (_, i) => (
                <div
                  key={i}
                  className={`size-3 rounded-full transition-all duration-100 ${
                    i === position.beat && isPlaying
                      ? 'bg-primary shadow-[0_0_10px_#38ff14] scale-125'
                      : 'bg-surface border border-border-muted'
                  }`}
                />
              ))}
            </div>
          </div>
          {/* Direction Indicators */}
          <div className="flex gap-3">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${
                direction === 'clockwise'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border-muted bg-surface text-slate-400'
              }`}
              onClick={() => setDirection('clockwise')}
            >
              <span className="material-symbols-outlined text-sm">rotate_right</span> CW
            </button>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${
                direction === 'counter'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border-muted bg-surface text-slate-400'
              }`}
              onClick={() => setDirection('counter')}
            >
              <span className="material-symbols-outlined text-sm">rotate_left</span> CCW
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
