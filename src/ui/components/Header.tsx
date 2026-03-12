import { useConductor } from '../../audio/useConductor';
import { useJudge } from '../../engine/useJudge';

export default function Header() {
  const { transport, config, play, pause, stop, setBpm, setBarLength } = useConductor();
  const { resetSession } = useJudge();

  const isPlaying = transport === 'playing';
  const isCounting = transport === 'counting';
  const isRunning = isPlaying || isCounting;
  const isPaused = transport === 'paused';

  return (
    <header className="border-b border-border-muted bg-surface/50 backdrop-blur-md px-6 py-2 flex items-center justify-between gap-6 shrink-0">
      <div className="flex items-center gap-3">
        <div className="text-primary size-6">
          <span className="material-symbols-outlined text-3xl">adjust</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight">CircleSense</h1>
      </div>

      <div className="flex items-center gap-4 bg-background-dark/50 p-1.5 rounded-lg border border-border-muted">
        <button
          className={`size-9 flex items-center justify-center rounded border transition-colors ${isRunning ? 'bg-primary/20 border-primary/30' : 'border-border-muted hover:bg-primary/20 hover:border-primary/30'}`}
          onClick={isRunning ? pause : play}
        >
          <span className="material-symbols-outlined text-primary text-lg">
            {isRunning ? 'pause' : 'play_arrow'}
          </span>
        </button>
        <button
          className="size-9 flex items-center justify-center rounded border border-border-muted hover:bg-primary/20 hover:border-primary/30 transition-colors"
          onClick={() => { stop(); resetSession(); }}
        >
          <span className={`material-symbols-outlined text-lg ${transport === 'stopped' ? 'text-slate-600' : ''}`}>stop</span>
        </button>
        <div className="w-px h-6 bg-border-muted mx-2" />
        <div className="flex items-center gap-2 px-2">
          {isCounting && (
            <span className="size-2 rounded-full bg-yellow-400 animate-pulse" />
          )}
          {isPlaying && (
            <span className="size-2 rounded-full bg-primary shadow-[0_0_6px_#38ff14] animate-pulse" />
          )}
          {isPaused && (
            <span className="size-2 rounded-full bg-yellow-400" />
          )}
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
            {transport}
          </span>
        </div>
      </div>

      <div className="flex flex-1 max-w-md items-center gap-8">
        <div className="flex flex-col flex-1 gap-1">
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-slate-400 font-bold">
            <span>Tempo (BPM)</span>
            <span className="text-primary">{config.bpm}</span>
          </div>
          <input
            className="w-full h-1.5 bg-border-muted rounded-full appearance-none cursor-pointer accent-primary"
            max={180}
            min={40}
            step={10}
            type="range"
            value={config.bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex bg-surface rounded-lg p-1 border border-border-muted">
          {([1, 2, 3, 4] as const).map((n) => (
            <button
              key={n}
              className={`px-3 py-1 text-xs font-bold rounded ${config.barLength === n ? 'bg-primary text-background-dark' : 'text-slate-400'}`}
              onClick={() => setBarLength(n)}
            >
              {n} Bar{n > 1 ? 's' : ''}
            </button>
          ))}
        </div>
        <button className="p-2 border border-border-muted rounded-lg text-slate-400">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>
    </header>
  );
}
