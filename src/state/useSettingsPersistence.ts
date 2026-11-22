import { getJudge } from '../engine/useJudge';
import { useEffect, useRef } from 'react';
import { getConductor } from '../audio/useConductor';
import { getPlaybackEngine } from '../audio/usePlaybackEngine';
import { loadSettings, saveSettings, startingProgression, type Settings } from './sessionStore';

const DEBOUNCE_MS = 500;

export function useSettingsPersistence(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const judge = getJudge();
    const conductor = getConductor();
    const playbackEngine = getPlaybackEngine();

    // Restore saved settings on mount
    const saved = loadSettings();
    if (saved) {
      judge.setTarget(saved.target);
      conductor.setBpm(saved.bpm);
      conductor.setBarLength(saved.barLength);
      playbackEngine.setDirection(saved.direction);
      playbackEngine.setPlaybackMode(saved.playbackMode);
      playbackEngine.setToneType(saved.toneType);
    }
    const progression = startingProgression(saved);
    if (progression.length > 0) playbackEngine.setProgression(progression);

    // Persist settings on change (debounced)
    function scheduleSave() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const cSnap = conductor.getSnapshot();
        const pSnap = playbackEngine.getSnapshot();
        const settings: Settings = {
          target: judge.getSnapshot().target,
          bpm: cSnap.config.bpm,
          barLength: cSnap.config.barLength,
          direction: pSnap.direction,
          playbackMode: pSnap.playbackMode,
          toneType: pSnap.toneType,
          progression: pSnap.progression,
        };
        saveSettings(settings);
      }, DEBOUNCE_MS);
    }

    let previousTarget = judge.getSnapshot().target;
    const unsubJudge = judge.subscribe(() => {
      if (previousTarget !== judge.getSnapshot().target) {
        previousTarget = judge.getSnapshot().target;
        scheduleSave();
      }
    });
    const unsubConductor = conductor.subscribe(scheduleSave);
    const unsubPlayback = playbackEngine.subscribe(scheduleSave);

    return () => {
      unsubJudge();
      unsubConductor();
      unsubPlayback();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
