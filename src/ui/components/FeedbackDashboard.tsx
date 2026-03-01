import { useJudge } from '../../engine/useJudge';

export default function FeedbackDashboard() {
  const {
    isInChord,
    isInScale,
    isActive,
    currentBarAccuracy,
    currentBarTotal,
    sessionAccuracy,
    sessionTotal,
    outOfScaleLog,
  } = useJudge();

  const hasNotes = currentBarTotal > 0;
  const hasSessionNotes = sessionTotal > 0;

  // Determine indicator state
  const showIn = isActive && hasNotes && isInChord;
  const showOut = isActive && hasNotes && !isInScale;
  const indicatorLabel = !isActive
    ? '--'
    : !hasNotes
      ? '--'
      : showIn
        ? 'IN'
        : showOut
          ? 'OUT'
          : 'OK';

  const indicatorColor = showOut
    ? 'border-red-500 text-red-500'
    : showIn
      ? 'border-primary text-primary'
      : 'border-slate-600 text-slate-500';

  const indicatorGlow = showIn
    ? 'shadow-[0_0_20px_rgba(56,255,20,0.2)]'
    : showOut
      ? 'shadow-[0_0_20px_rgba(239,68,68,0.2)]'
      : '';

  const indicatorSubtext = showOut
    ? 'OFF KEY'
    : showIn
      ? 'PERFECT PITCH'
      : isActive
        ? 'WAITING'
        : 'INACTIVE';

  const indicatorSubColor = showOut
    ? 'text-red-500'
    : showIn
      ? 'text-primary'
      : 'text-slate-500';

  const barDisplay = isActive && hasNotes ? `${currentBarAccuracy}%` : '--';
  const sessionDisplay = isActive && hasSessionNotes ? `${sessionAccuracy}%` : '--';

  return (
    <aside className="w-80 border-l border-border-muted bg-surface/30 p-6 flex flex-col gap-6 overflow-y-auto">
      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Live Feedback</h3>

      {/* In/Out Indicator */}
      <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-primary/5 border border-primary/20">
        <div className={`size-24 rounded-full border-8 flex items-center justify-center ${indicatorColor} ${indicatorGlow}`}>
          <span className="font-black text-xl">{indicatorLabel}</span>
        </div>
        <p className={`mt-4 text-xs font-bold tracking-widest ${indicatorSubColor}`}>{indicatorSubtext}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-3">
        <div className="bg-surface border border-border-muted p-4 rounded-xl">
          <div className="flex justify-between items-end">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Current Bar</span>
            <span className="text-xl font-black text-primary">{barDisplay}</span>
          </div>
          <div className="mt-2 h-1 w-full bg-border-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: isActive && hasNotes ? `${currentBarAccuracy}%` : '0%' }}
            />
          </div>
        </div>
        <div className="bg-surface border border-border-muted p-4 rounded-xl">
          <div className="flex justify-between items-end">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Session Avg</span>
            <span className="text-xl font-black text-white">{sessionDisplay}</span>
          </div>
          <div className="mt-2 h-1 w-full bg-border-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-white/40 transition-all"
              style={{ width: isActive && hasSessionNotes ? `${sessionAccuracy}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* Error Log */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Out-of-Scale Log</h4>
        <div className="space-y-2">
          {outOfScaleLog.length === 0 ? (
            <p className="text-xs text-slate-600 italic">
              {isActive ? 'No wrong notes yet' : 'Start playing to see feedback'}
            </p>
          ) : (
            outOfScaleLog.map((entry) => (
              <div
                key={entry.pitchClass}
                className="flex justify-between items-center p-2 rounded bg-red-500/10 border border-red-500/20"
              >
                <span className="font-bold text-red-500">{entry.noteName}</span>
                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">
                  {entry.count}x
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
