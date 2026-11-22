import { useEffect, useState } from 'react';
import { getConductor } from '../../audio/useConductor';

const read = () => getConductor().audio.describe();

/** Shown only with ?debug in the address. Reports the audio state for diagnosing a device we cannot see. */
export default function AudioDebug() {
  const [text, setText] = useState(read);
  useEffect(() => {
    const timer = setInterval(() => setText(read()), 500);
    return () => clearInterval(timer);
  }, []);
  return <p className="text-xs text-ink-muted">Debug: {text}</p>;
}
