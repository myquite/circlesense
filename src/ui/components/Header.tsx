export default function Header() {
  return (
    <header className="border-b border-border-muted bg-surface/50 backdrop-blur-md px-6 py-3 flex items-center justify-between gap-6">
      <div className="flex items-center gap-3">
        <div className="text-primary size-6">
          <span className="material-symbols-outlined text-3xl">adjust</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight">CircleSense</h1>
      </div>

      <div className="flex items-center gap-4 bg-background-dark/50 p-1.5 rounded-lg border border-border-muted">
        <button className="p-2 hover:bg-primary/20 rounded-lg transition-colors">
          <span className="material-symbols-outlined text-primary">play_arrow</span>
        </button>
        <button className="p-2 hover:bg-primary/20 rounded-lg transition-colors">
          <span className="material-symbols-outlined">pause</span>
        </button>
        <button className="p-2 hover:bg-primary/20 rounded-lg transition-colors">
          <span className="material-symbols-outlined">stop</span>
        </button>
        <div className="w-px h-6 bg-border-muted mx-2" />
        <button className="flex items-center gap-2 px-3 py-1.5 bg-primary text-background-dark rounded-lg font-bold text-sm">
          <span className="material-symbols-outlined text-sm">fiber_manual_record</span>
          RECORD
        </button>
      </div>

      <div className="flex flex-1 max-w-2xl items-center gap-8">
        <div className="flex flex-col flex-1 gap-1">
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-slate-400 font-bold">
            <span>Tempo (BPM)</span>
            <span className="text-primary">120</span>
          </div>
          <input
            className="w-full h-1.5 bg-border-muted rounded-full appearance-none cursor-pointer accent-primary"
            max={300}
            min={60}
            type="range"
            defaultValue={120}
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
          <button className="px-3 py-1 text-xs font-bold rounded bg-primary text-background-dark">1 Bar</button>
          <button className="px-3 py-1 text-xs font-bold rounded text-slate-400">2 Bars</button>
        </div>
        <button className="p-2 border border-border-muted rounded-lg text-slate-400">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>
    </header>
  )
}
