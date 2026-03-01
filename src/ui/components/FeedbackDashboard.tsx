export default function FeedbackDashboard() {
  return (
    <aside className="w-80 border-l border-border-muted bg-surface/30 p-6 flex flex-col gap-6 overflow-y-auto">
      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Live Feedback</h3>

      {/* In/Out Indicator */}
      <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-primary/5 border border-primary/20">
        <div className="size-24 rounded-full border-8 border-primary flex items-center justify-center shadow-[0_0_20px_rgba(56,255,20,0.2)]">
          <span className="text-primary font-black text-xl">IN</span>
        </div>
        <p className="mt-4 text-xs font-bold text-primary tracking-widest">PERFECT PITCH</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-3">
        <div className="bg-surface border border-border-muted p-4 rounded-xl">
          <div className="flex justify-between items-end">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Current Bar</span>
            <span className="text-xl font-black text-primary">92%</span>
          </div>
          <div className="mt-2 h-1 w-full bg-border-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: '92%' }} />
          </div>
        </div>
        <div className="bg-surface border border-border-muted p-4 rounded-xl">
          <div className="flex justify-between items-end">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Session Avg</span>
            <span className="text-xl font-black text-white">90%</span>
          </div>
          <div className="mt-2 h-1 w-full bg-border-muted rounded-full overflow-hidden">
            <div className="h-full bg-white/40" style={{ width: '90%' }} />
          </div>
        </div>
      </div>

      {/* Error Log */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Out-of-Scale Log</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center p-2 rounded bg-red-500/10 border border-red-500/20">
            <span className="font-bold text-red-500">F Natural</span>
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">4x</span>
          </div>
          <div className="flex justify-between items-center p-2 rounded bg-red-500/5 border border-red-500/10 opacity-70">
            <span className="font-bold text-red-400">C#</span>
            <span className="text-xs bg-red-400 text-white px-2 py-0.5 rounded-full font-bold">2x</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
