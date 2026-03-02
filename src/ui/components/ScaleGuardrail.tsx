import { useMemo } from 'react';
import { useJudge } from '../../engine/useJudge';
import { usePlaybackEngine } from '../../audio/usePlaybackEngine';
import { useMidiInput } from '../../input/useMidiInput';
import { useMicInput } from '../../input/useMicInput';
import { buildVoicing, NOTE_TO_PC } from '../../engine/chordData';
import { getMajorScale, PC_TO_NOTE_NAME } from '../../engine/scaleData';
import type { PitchClass } from '../../engine/chordData.types';

/** Major scale interval pattern in semitones */
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;

export default function ScaleGuardrail() {
  const { lastDetectedName, lastDetectedNote, isInScale, isActive } = useJudge();
  const { currentChord, key } = usePlaybackEngine();
  const midi = useMidiInput();
  const mic = useMicInput();

  // Compute scale notes ordered from root
  const rootPc = NOTE_TO_PC[key];
  const scale = useMemo(() => getMajorScale(rootPc), [rootPc]);
  const scaleNotes = useMemo(() =>
    MAJOR_INTERVALS.map((i) => {
      const pc = ((rootPc + i) % 12) as PitchClass;
      return { pitchClass: pc, note: PC_TO_NOTE_NAME[pc] };
    }),
    [rootPc],
  );

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
          <span className="text-lg font-black text-primary">{key} MAJOR</span>
        </div>
      </div>

      <div className="flex-1 flex gap-2">
        <div className="flex-1 bg-background-dark/50 rounded-xl p-2 flex items-center justify-between border border-border-muted/50">
          <div className="flex items-center gap-2">
            {scaleNotes.map(({ pitchClass, note }) => {
              const isChordTone = chordTones.has(pitchClass);
              const isInScaleNote = scale.has(pitchClass);

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
        <button
          type="button"
          onClick={() => midi.requestAccess()}
          className="flex gap-4 cursor-pointer hover:opacity-80 transition-opacity"
          title={midi.isConnected ? 'Click to reconnect MIDI' : 'Click to connect MIDI device'}
        >
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 font-bold uppercase">MIDI</span>
            <span className="text-sm font-bold text-white flex items-center gap-2">
              {midi.activeDevice?.name ?? 'No Device'}
              <span className={`size-2 rounded-full ${midi.isConnected ? 'bg-primary' : 'bg-slate-600'}`} />
            </span>
          </div>
        </button>
        <div className="w-px bg-border-muted" />
        <button
          type="button"
          onClick={() => mic.isConnected ? mic.disconnect() : mic.requestAccess()}
          className="flex gap-4 cursor-pointer hover:opacity-80 transition-opacity"
          title={mic.isConnected ? 'Click to disconnect microphone' : 'Click to connect microphone'}
        >
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Mic</span>
            <span className="text-sm font-bold text-white flex items-center gap-2">
              {mic.activeDevice?.name ?? 'No Device'}
              <span className={`size-2 rounded-full ${mic.isConnected ? 'bg-primary' : 'bg-slate-600'}`} />
            </span>
          </div>
        </button>
      </div>
    </footer>
  );
}
