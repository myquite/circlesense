import { useConductor } from '../../audio/useConductor';
import { usePlaybackEngine } from '../../audio/usePlaybackEngine';

const NODE_POSITIONS = [
  { top: '0', left: '50%', transform: '-translate-x-1/2 -translate-y-1/2' },
  { top: '50%', right: '0', transform: 'translate-x-1/2 -translate-y-1/2' },
  { bottom: '0', left: '50%', transform: '-translate-x-1/2 translate-y-1/2' },
  { top: '50%', left: '0', transform: '-translate-x-1/2 -translate-y-1/2' },
] as const;

export default function CircleEngine() {
  const { position, config, transport } = useConductor();
  const { currentChord, nextChord, direction, setDirection, chordIndex, progressionLabels } = usePlaybackEngine();
  const isPlaying = transport === 'playing';

  return (
    <div className="flex-1 relative flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent">
      {/* Direction Indicators */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex gap-4">
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold transition-colors ${
            direction === 'clockwise'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border-muted bg-surface text-slate-400'
          }`}
          onClick={() => setDirection('clockwise')}
        >
          <span className="material-symbols-outlined text-sm">rotate_right</span> CLOCKWISE
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold transition-colors ${
            direction === 'counter'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border-muted bg-surface text-slate-400'
          }`}
          onClick={() => setDirection('counter')}
        >
          <span className="material-symbols-outlined text-sm">rotate_left</span> COUNTER
        </button>
      </div>

      {/* The Circle */}
      <div className="relative size-[520px] rounded-full border-[12px] border-surface shadow-[0_0_50px_rgba(56,255,20,0.05)] flex items-center justify-center">
        {/* Background Ring */}
        <div className="absolute inset-0 rounded-full border border-border-muted/30 border-dashed animate-[spin_60s_linear_infinite]" />

        {/* Chord Nodes */}
        {progressionLabels.map((label, i) => {
          const pos = NODE_POSITIONS[i];
          const isActiveNode = isPlaying && i === chordIndex;
          return (
            <div
              key={i}
              className={`absolute px-4 py-2 rounded-lg font-bold transition-all ${pos.transform} ${
                isActiveNode
                  ? 'bg-primary/20 border-2 border-primary text-primary shadow-[0_0_15px_rgba(56,255,20,0.3)]'
                  : 'bg-surface border border-border-muted text-slate-400'
              }`}
              style={{
                top: 'top' in pos ? pos.top : undefined,
                bottom: 'bottom' in pos ? pos.bottom : undefined,
                left: 'left' in pos ? pos.left : undefined,
                right: 'right' in pos ? pos.right : undefined,
              }}
            >
              {label}
            </div>
          );
        })}

        {/* Active Chord */}
        <div className="absolute right-[15%] top-[15%] px-6 py-3 bg-primary shadow-[0_0_30px_#38ff14] text-background-dark rounded-xl font-black text-2xl z-10 border-4 border-background-dark">
          {currentChord?.label ?? '--'}
        </div>
        <div className="absolute right-[5%] bottom-[30%] px-4 py-2 bg-primary/20 border border-primary/50 text-primary rounded-lg font-bold opacity-60">
          {nextChord?.label ?? '--'}
        </div>

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
        </div>
      </div>
    </div>
  )
}
