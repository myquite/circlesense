import { useEffect, useState } from 'react';
import { getConductor } from '../../audio/useConductor';
import { currentAudioSession } from '../../audio/audioSession';

function read(): string {
  const context = getConductor().audioContext;
  return `audio ${context.state} · ${context.sampleRate} Hz · session ${currentAudioSession()}`;
}

/** Shown only with ?debug in the address. Reports the audio state for diagnosing a device we cannot see. */
export default function AudioDebug() {
  const [text, setText] = useState(read);
  useEffect(() => {
    const timer = setInterval(() => setText(read()), 500);
    return () => clearInterval(timer);
  }, []);
  return <p className="text-xs text-ink-muted">Debug: {text}</p>;
}
