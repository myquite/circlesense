export default function ScaleGuardrail() {
  const scaleNotes = [
    { note: 'G', active: true },
    { note: 'A', inScale: true },
    { note: 'B', inScale: true },
    { note: 'C', dim: true },
    { note: 'D', dim: true },
    { note: 'E', dim: true },
    { note: 'F#', inScale: true },
  ]

  return (
    <footer className="bg-surface border-t border-border-muted p-4 flex items-center gap-8">
      <div className="flex flex-col gap-1 min-w-[200px]">
        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-tighter">Selected Guardrail</span>
        <div className="flex items-center gap-2">
          <span className="text-lg font-black text-primary">G MAJOR</span>
          <span className="material-symbols-outlined text-slate-500 text-sm">lock</span>
        </div>
      </div>

      <div className="flex-1 flex gap-2">
        <div className="flex-1 bg-background-dark/50 rounded-xl p-2 flex items-center justify-between border border-border-muted/50">
          <div className="flex items-center gap-2">
            {scaleNotes.map(({ note, active, inScale, dim }) => (
              <div
                key={note}
                className={`size-10 rounded-lg flex items-center justify-center font-bold ${
                  active
                    ? 'bg-primary text-background-dark font-black shadow-[0_0_15px_#38ff14]'
                    : inScale
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : dim
                        ? 'bg-primary/10 text-white/40 border border-border-muted'
                        : ''
                }`}
              >
                {note}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 px-4">
            <div className="flex flex-col items-center">
              <span className="text-[8px] text-slate-500 font-bold uppercase">Detected</span>
              <div className="size-8 rounded-full border-2 border-red-500 flex items-center justify-center text-red-500 font-black text-sm bg-red-500/10">
                F
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-slate-500 font-bold uppercase">Input Source</span>
          <span className="text-sm font-bold text-white flex items-center gap-2">
            Scarlett 2i2 <span className="size-2 rounded-full bg-primary" />
          </span>
        </div>
      </div>
    </footer>
  )
}
