import { useEffect, useRef } from 'react';
import { getConductor } from '../audio/useConductor';
import { getPlaybackEngine } from '../audio/usePlaybackEngine';
import { loadSettings, saveSettings, type Settings } from './sessionStore';

const DEBOUNCE_MS = 500;

export function useSettingsPersistence(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const conductor = getConductor();
    const playbackEngine = getPlaybackEngine();

    // Restore saved settings on mount
    const saved = loadSettings();
    if (saved) {
      conductor.setBpm(saved.bpm);
      conductor.setBarLength(saved.barLength);
      playbackEngine.setChordQuality(saved.chordQuality);
      playbackEngine.setDirection(saved.direction);
    }

    // Persist settings on change (debounced)
    function scheduleSave() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const cSnap = conductor.getSnapshot();
        const pSnap = playbackEngine.getSnapshot();
        const settings: Settings = {
          bpm: cSnap.config.bpm,
          barLength: cSnap.config.barLength,
          chordQuality: pSnap.chordQuality,
          direction: pSnap.direction,
        };
        saveSettings(settings);
      }, DEBOUNCE_MS);
    }

    const unsubConductor = conductor.subscribe(scheduleSave);
    const unsubPlayback = playbackEngine.subscribe(scheduleSave);

    return () => {
      unsubConductor();
      unsubPlayback();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
