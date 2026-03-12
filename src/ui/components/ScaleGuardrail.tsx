import { useMemo } from 'react';
import { useJudge } from '../../engine/useJudge';
import { usePlaybackEngine } from '../../audio/usePlaybackEngine';
import { useMidiInput } from '../../input/useMidiInput';
import { useMicInput } from '../../input/useMicInput';
import { buildVoicing } from '../../engine/chordData';
import { PC_TO_NOTE_NAME } from '../../engine/scaleData';

export default function ScaleGuardrail() {
  const { lastDetectedName, lastDetectedNote, isInChord, isActive } = useJudge();
  const { currentChord } = usePlaybackEngine();
  const midi = useMidiInput();
  const mic = useMicInput();

  // Compute chord tones for the current chord
  const chordTones = useMemo(() => {
    if (!currentChord) return [];
    const voicing = buildVoicing(currentChord.rootPitchClass, currentChord.quality);
    const labels = ['R', '3rd', '5th'];
    return voicing.pitchClasses.map((pc, i) => ({
      pitchClass: pc,
      note: PC_TO_NOTE_NAME[pc],
      label: labels[i] ?? '',
    }));
  }, [currentChord]);

  // Determine detected note display
  const hasDetection = isActive && lastDetectedNote !== null;
  const detectedIsInChord = hasDetection && isInChord;
  const detectedBorderColor = hasDetection
    ? detectedIsInChord
      ? 'border-primary text-primary bg-primary/10'
      : 'border-red-500 text-red-500 bg-red-500/10'
    : 'border-slate-600 text-slate-500';

  return (
    <footer className="bg-surface border-t border-border-muted px-4 py-2 flex items-center gap-8 shrink-0">
      <div className="flex flex-col gap-1 min-w-[200px]">
        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-tighter">Current Chord</span>
        <div className="flex items-center gap-2">
          <span className="text-lg font-black text-primary">{currentChord?.label ?? '--'}</span>
        </div>
      </div>

      <div className="flex-1 flex gap-2">
        <div className="flex-1 bg-background-dark/50 rounded-xl p-2 flex items-center justify-between border border-border-muted/50">
          <div className="flex items-center gap-3">
            {chordTones.length === 0 ? (
              <span className="text-xs text-slate-500 italic px-2">No chord playing</span>
            ) : (
              chordTones.map(({ pitchClass, note, label }) => {
                const isDetected = hasDetection && lastDetectedNote === pitchClass;
                return (
                  <div key={`${note}-${label}`} className="flex flex-col items-center gap-1">
                    <span className="text-[8px] text-slate-500 font-bold uppercase">{label}</span>
                    <div
                      className={`size-10 rounded-lg flex items-center justify-center font-bold ${
                        isDetected
                          ? 'bg-primary text-background-dark font-black shadow-[0_0_15px_#38ff14]'
                          : label === 'R'
                            ? 'bg-primary/20 text-primary border border-primary/50 font-black'
                            : 'bg-primary/10 text-primary/70 border border-primary/30'
                      }`}
                    >
                      {note}
                    </div>
                  </div>
                );
              })
            )}
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
