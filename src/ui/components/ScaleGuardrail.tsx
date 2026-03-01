import { useJudge } from '../../engine/useJudge';
import { usePlaybackEngine } from '../../audio/usePlaybackEngine';
import { buildVoicing } from '../../engine/chordData';
import { G_MAJOR_SCALE } from '../../engine/scaleData';
import type { PitchClass } from '../../engine/chordData.types';

/** Ordered G Major scale notes for display */
const SCALE_NOTES: { pitchClass: PitchClass; note: string }[] = [
  { pitchClass: 7, note: 'G' },
  { pitchClass: 9, note: 'A' },
  { pitchClass: 11, note: 'B' },
  { pitchClass: 0, note: 'C' },
  { pitchClass: 2, note: 'D' },
  { pitchClass: 4, note: 'E' },
  { pitchClass: 6, note: 'F#' },
];

export default function ScaleGuardrail() {
  const { lastDetectedName, lastDetectedNote, isInScale, isActive } = useJudge();
  const { currentChord } = usePlaybackEngine();

  // Get current chord tones for highlighting
  const chordTones = new Set<PitchClass>();
  if (currentChord) {
    const voicing = buildVoicing(currentChord.rootPitchClass, currentChord.quality);
    for (const pc of voicing.pitchClasses) {
      chordTones.add(pc);
    }
  }

  // Determine detected note display
  const hasDetection = isActive && lastDetectedNote !== null;
  const detectedIsInScale = hasDetection && isInScale;
  const detectedBorderColor = hasDetection
    ? detectedIsInScale
      ? 'border-primary text-primary bg-primary/10'
      : 'border-red-500 text-red-500 bg-red-500/10'
    : 'border-slate-600 text-slate-500';

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
            {SCALE_NOTES.map(({ pitchClass, note }) => {
              const isChordTone = chordTones.has(pitchClass);
              const isInScaleNote = G_MAJOR_SCALE.has(pitchClass);

              return (
                <div
                  key={note}
                  className={`size-10 rounded-lg flex items-center justify-center font-bold ${
                    isChordTone
                      ? 'bg-primary text-background-dark font-black shadow-[0_0_15px_#38ff14]'
                      : isInScaleNote
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-primary/10 text-white/40 border border-border-muted'
                  }`}
                >
                  {note}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 px-4">
            <div className="flex flex-col items-center">
              <span className="text-[8px] text-slate-500 font-bold uppercase">Detected</span>
              <div className={`size-8 rounded-full border-2 flex items-center justify-center font-black text-sm ${detectedBorderColor}`}>
                {hasDetection ? lastDetectedName : '--'}
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
  );
}
