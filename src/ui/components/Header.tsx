import { useConductor } from '../../audio/useConductor';

export default function Header() {
  const { transport, config, play, pause, stop, setBpm, setBarLength } = useConductor();

  const isPlaying = transport === 'playing';
  const isPaused = transport === 'paused';

  return (
    <header className="border-b border-border-muted bg-surface/50 backdrop-blur-md px-6 py-3 flex items-center justify-between gap-6">
      <div className="flex items-center gap-3">
        <div className="text-primary size-6">
          <span className="material-symbols-outlined text-3xl">adjust</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight">CircleSense</h1>
      </div>

      <div className="flex items-center gap-4 bg-background-dark/50 p-1.5 rounded-lg border border-border-muted">
        <button
          className={`p-2 rounded-lg transition-colors ${isPlaying ? 'bg-primary/20' : 'hover:bg-primary/20'}`}
          onClick={isPlaying ? pause : play}
        >
          <span className="material-symbols-outlined text-primary">
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>
        <button
          className="p-2 hover:bg-primary/20 rounded-lg transition-colors"
          onClick={stop}
        >
          <span className={`material-symbols-outlined ${transport === 'stopped' ? 'text-slate-600' : ''}`}>stop</span>
        </button>
        <div className="w-px h-6 bg-border-muted mx-2" />
        <div className="flex items-center gap-2 px-2">
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

      <div className="flex flex-1 max-w-2xl items-center gap-8">
        <div className="flex flex-col flex-1 gap-1">
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-slate-400 font-bold">
            <span>Tempo (BPM)</span>
            <span className="text-primary">{config.bpm}</span>
          </div>
          <input
            className="w-full h-1.5 bg-border-muted rounded-full appearance-none cursor-pointer accent-primary"
            max={300}
            min={60}
            type="range"
            value={config.bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1 w-48">
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Chord Type</span>
          <select
            className="bg-surface border border-border-muted text-xs rounded-lg px-2 py-1 focus:ring-primary focus:border-primary"
            defaultValue="Dominant 7"
          >
            <option>Major 7</option>
            <option>Dominant 7</option>
            <option>Minor 7</option>
            <option>Diminished</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex bg-surface rounded-lg p-1 border border-border-muted">
          <button
            className={`px-3 py-1 text-xs font-bold rounded ${config.barLength === 1 ? 'bg-primary text-background-dark' : 'text-slate-400'}`}
            onClick={() => setBarLength(1)}
          >
            1 Bar
          </button>
          <button
            className={`px-3 py-1 text-xs font-bold rounded ${config.barLength === 2 ? 'bg-primary text-background-dark' : 'text-slate-400'}`}
            onClick={() => setBarLength(2)}
          >
            2 Bars
          </button>
        </div>
        <button className="p-2 border border-border-muted rounded-lg text-slate-400">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>
    </header>
  )
}
