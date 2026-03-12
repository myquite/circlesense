import { useState } from 'react';
import { usePlaybackEngine } from '../../audio/usePlaybackEngine';

export default function ControlSidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const {
    direction,
    setDirection,
    playbackMode,
    setPlaybackMode,
    progression,
    removeChord,
    clearProgression,
  } = usePlaybackEngine();

  return (
    <>
      {/* Toggle Button — always visible */}
      <button
        className={`absolute top-4 left-4 z-30 size-9 flex items-center justify-center rounded border border-border-muted bg-surface/80 backdrop-blur-sm text-slate-400 hover:text-primary hover:border-primary/30 transition-all ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        onClick={() => setIsOpen(true)}
      >
        <span className="material-symbols-outlined text-lg">menu</span>
      </button>

      {/* Sidebar Panel */}
      <aside
        className={`relative z-20 flex flex-col border-r border-border-muted bg-surface/30 backdrop-blur-sm transition-all duration-300 overflow-hidden ${
          isOpen ? 'w-56' : 'w-0'
        }`}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Controls</h3>
          <button
            className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <span className="material-symbols-outlined text-base">chevron_left</span>
          </button>
        </div>

        <div className="flex flex-col gap-5 px-4 py-3 min-w-[224px]">
          {/* Playback Mode */}
          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Mode</h4>
            <div className="flex gap-2">
              <button
                className={`flex-1 px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${
                  playbackMode === 'sequential'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border-muted bg-surface text-slate-400 hover:border-primary/30'
                }`}
                onClick={() => setPlaybackMode('sequential')}
              >
                Sequential
              </button>
              <button
                className={`flex-1 px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${
                  playbackMode === 'random'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border-muted bg-surface text-slate-400 hover:border-primary/30'
                }`}
                onClick={() => setPlaybackMode('random')}
              >
                Random
              </button>
            </div>
          </section>

          {/* Direction */}
          {playbackMode === 'sequential' && (
            <section>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Direction</h4>
              <div className="flex gap-2">
                <button
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-full border text-xs font-bold transition-colors ${
                    direction === 'clockwise'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border-muted bg-surface text-slate-400 hover:border-primary/30'
                  }`}
                  onClick={() => setDirection('clockwise')}
                >
                  <span className="material-symbols-outlined text-sm">rotate_right</span> CW
                </button>
                <button
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-full border text-xs font-bold transition-colors ${
                    direction === 'counter'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border-muted bg-surface text-slate-400 hover:border-primary/30'
                  }`}
                  onClick={() => setDirection('counter')}
                >
                  <span className="material-symbols-outlined text-sm">rotate_left</span> CCW
                </button>
              </div>
            </section>
          )}

          {/* Progression */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Progression ({progression.length})
              </h4>
              {progression.length > 0 && (
                <button
                  className="text-[10px] uppercase tracking-widest text-red-400 font-bold hover:text-red-300 transition-colors"
                  onClick={clearProgression}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[36px] bg-surface/50 border border-border-muted rounded-lg p-2">
              {progression.length === 0 ? (
                <span className="text-[10px] text-slate-500 italic">Click chords on the circle</span>
              ) : (
                progression.map((chord, idx) => (
                  <div
                    key={`${chord.label}-${idx}`}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-bold ${
                      chord.quality === 'minor'
                        ? 'bg-blue-500/10 border-blue-400/30 text-blue-400'
                        : 'bg-primary/10 border-primary/30 text-primary'
                    }`}
                  >
                    <span>{chord.label}</span>
                    <button
                      className="text-slate-500 hover:text-red-400 transition-colors ml-0.5"
                      onClick={() => removeChord(idx)}
                    >
                      &times;
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
