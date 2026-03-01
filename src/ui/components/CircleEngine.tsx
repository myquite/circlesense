export default function CircleEngine() {
  return (
    <div className="flex-1 relative flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent">
      {/* Direction Indicators */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex gap-4">
        <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-primary bg-primary/10 text-primary text-xs font-bold">
          <span className="material-symbols-outlined text-sm">rotate_right</span> CLOCKWISE
        </button>
        <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-border-muted bg-surface text-slate-400 text-xs font-bold">
          <span className="material-symbols-outlined text-sm">rotate_left</span> COUNTER
        </button>
      </div>

      {/* The Circle */}
      <div className="relative size-[520px] rounded-full border-[12px] border-surface shadow-[0_0_50px_rgba(56,255,20,0.05)] flex items-center justify-center">
        {/* Background Ring */}
        <div className="absolute inset-0 rounded-full border border-border-muted/30 border-dashed animate-[spin_60s_linear_infinite]" />

        {/* Chord Nodes */}
        <div className="absolute top-0 -translate-y-1/2 px-4 py-2 bg-surface border border-border-muted rounded-lg font-bold text-slate-400">C</div>
        <div className="absolute right-0 translate-x-1/2 px-4 py-2 bg-surface border border-border-muted rounded-lg font-bold text-slate-400">G</div>
        <div className="absolute bottom-0 translate-y-1/2 px-4 py-2 bg-surface border border-border-muted rounded-lg font-bold text-slate-400">F</div>

        {/* Active Chord */}
        <div className="absolute right-[15%] top-[15%] px-6 py-3 bg-primary shadow-[0_0_30px_#38ff14] text-background-dark rounded-xl font-black text-2xl z-10 border-4 border-background-dark">E7</div>
        <div className="absolute right-[5%] bottom-[30%] px-4 py-2 bg-primary/20 border border-primary/50 text-primary rounded-lg font-bold opacity-60">A7</div>

        {/* Central HUD */}
        <div className="text-center space-y-4">
          <div className="text-slate-400 text-xs tracking-[0.2em] font-bold uppercase">Now Playing</div>
          <div className="text-7xl font-black text-white tracking-tighter">E7</div>
          <div className="flex items-center justify-center gap-3">
            <div className="px-3 py-1 bg-surface border border-border-muted rounded text-sm font-mono">BAR 1/2</div>
            <div className="size-3 rounded-full bg-primary shadow-[0_0_10px_#38ff14] animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
