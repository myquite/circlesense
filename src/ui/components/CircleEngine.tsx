import { useConductor } from '../../audio/useConductor';
import { usePlaybackEngine } from '../../audio/usePlaybackEngine';
import { CIRCLE_MAJOR, CIRCLE_MINOR, makeChordDefinition } from '../../engine/chordData';
import type { ChordQuality, NoteName } from '../../engine/chordData.types';

const RADIUS_OUTER = 260;
const RADIUS_INNER = 195;

export default function CircleEngine() {
  const { position, config, transport, countInBeat } = useConductor();
  const {
    currentChord,
    direction,
    setDirection,
    playbackMode,
    setPlaybackMode,
    progression,
    addChord,
    removeChord,
    clearProgression,
  } = usePlaybackEngine();
  const isPlaying = transport === 'playing';
  const isCounting = transport === 'counting';

  const activeRoot = isPlaying ? currentChord?.root : null;
  const activeQuality = isPlaying ? currentChord?.quality : null;

  function handleChordClick(displayName: string, root: NoteName, quality: ChordQuality) {
    addChord(makeChordDefinition(displayName, root, quality));
  }

  function isInProgression(root: NoteName, quality: ChordQuality): boolean {
    return progression.some((c) => c.root === root && c.quality === quality);
  }

  function isActiveChord(root: NoteName, quality: ChordQuality): boolean {
    return root === activeRoot && quality === activeQuality;
  }

  return (
    <div className="flex-1 relative flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent">
      {/* The Circle */}
      <div className="relative size-[580px] rounded-full border border-border-muted/30 shadow-[0_0_50px_rgba(56,255,20,0.05)] flex items-center justify-center">

        {/* Outer Ring — Major Chords */}
        {CIRCLE_MAJOR.map((entry, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const x = Math.cos(angle) * RADIUS_OUTER;
          const y = Math.sin(angle) * RADIUS_OUTER;
          const active = isActiveChord(entry.root, entry.quality);
          const inProg = isInProgression(entry.root, entry.quality);

          return (
            <button
              key={`major-${entry.displayName}`}
              className={`absolute flex items-center justify-center rounded-full font-bold text-sm transition-all duration-200 cursor-pointer hover:scale-105 ${
                active
                  ? 'size-14 bg-primary/20 border-2 border-primary text-primary shadow-[0_0_20px_rgba(56,255,20,0.4)] scale-110 z-10'
                  : inProg
                    ? 'size-12 bg-primary/10 border-2 border-primary/50 text-primary/80'
                    : 'size-12 bg-surface border border-border-muted text-slate-400 hover:border-primary/30 hover:text-slate-300'
              }`}
              style={{
                transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
                left: '50%',
                top: '50%',
              }}
              onClick={() => handleChordClick(entry.displayName, entry.root, entry.quality)}
            >
              {entry.displayName}
            </button>
          );
        })}

        {/* Inner Ring — Minor Chords */}
        {CIRCLE_MINOR.map((entry, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const x = Math.cos(angle) * RADIUS_INNER;
          const y = Math.sin(angle) * RADIUS_INNER;
          const active = isActiveChord(entry.root, entry.quality);
          const inProg = isInProgression(entry.root, entry.quality);

          return (
            <button
              key={`minor-${entry.displayName}`}
              className={`absolute flex items-center justify-center rounded-full font-bold transition-all duration-200 cursor-pointer hover:scale-105 ${
                active
                  ? 'size-11 bg-blue-500/20 border-2 border-blue-400 text-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.4)] scale-110 z-10'
                  : inProg
                    ? 'size-9 bg-blue-500/10 border-2 border-blue-400/50 text-blue-400/80'
                    : 'size-9 bg-surface/80 border border-border-muted text-slate-500 hover:border-blue-400/30 hover:text-slate-400'
              }`}
              style={{
                transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
                left: '50%',
                top: '50%',
                fontSize: '0.65rem',
              }}
              onClick={() => handleChordClick(entry.displayName, entry.root, entry.quality)}
            >
              {entry.displayName}
            </button>
          );
        })}

        {/* Central HUD */}
        <div className="text-center space-y-4">
          {isCounting ? (
            <>
              <div className="text-yellow-400 text-xs tracking-[0.2em] font-bold uppercase animate-pulse">Count In</div>
              <div className="text-7xl font-black text-yellow-400 tracking-tighter">{countInBeat}</div>
              <div className="flex justify-center gap-1">
                {Array.from({ length: 4 }, (_, i) => (
                  <div
                    key={i}
                    className={`size-3 rounded-full transition-all duration-100 ${
                      i < countInBeat
                        ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]'
                        : 'bg-surface border border-border-muted'
                    }`}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
          {/* Playback Mode + Direction */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-2">
              <button
                className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${
                  playbackMode === 'sequential'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border-muted bg-surface text-slate-400'
                }`}
                onClick={() => setPlaybackMode('sequential')}
              >
                Sequential
              </button>
              <button
                className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${
                  playbackMode === 'random'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border-muted bg-surface text-slate-400'
                }`}
                onClick={() => setPlaybackMode('random')}
              >
                Random
              </button>
            </div>
            {playbackMode === 'sequential' && (
              <div className="flex gap-2">
                <button
                  className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold transition-colors ${
                    direction === 'clockwise'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border-muted bg-surface text-slate-400'
                  }`}
                  onClick={() => setDirection('clockwise')}
                >
                  <span className="material-symbols-outlined text-sm">rotate_right</span> CW
                </button>
                <button
                  className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold transition-colors ${
                    direction === 'counter'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border-muted bg-surface text-slate-400'
                  }`}
                  onClick={() => setDirection('counter')}
                >
                  <span className="material-symbols-outlined text-sm">rotate_left</span> CCW
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progression Builder */}
      <div className="mt-6 flex flex-col items-center gap-2 max-w-lg w-full">
        <div className="flex items-center justify-between w-full px-2">
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
            Progression ({progression.length} chords)
          </span>
          {progression.length > 0 && (
            <button
              className="text-[10px] uppercase tracking-widest text-red-400 font-bold hover:text-red-300 transition-colors"
              onClick={clearProgression}
            >
              Clear All
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 min-h-[40px] w-full bg-surface/50 border border-border-muted rounded-lg p-2">
          {progression.length === 0 ? (
            <span className="text-xs text-slate-500 italic px-1">Click chords on the circle to build a progression</span>
          ) : (
            progression.map((chord, idx) => (
              <div
                key={`${chord.label}-${idx}`}
                className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-bold ${
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
      </div>
    </div>
  );
}
