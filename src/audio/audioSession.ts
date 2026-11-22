/**
 * iOS routes Web Audio through the "ambient" audio session by default, which the
 * ring/silent switch mutes. Declaring the session as playback makes the accompaniment
 * audible with the switch on silent. Safari refuses microphone capture in a playback-only
 * session, so while the microphone is open the session is handed back to 'auto' and Safari
 * manages routing itself, as it does for any page that records. Only Safari implements
 * this; elsewhere it is a no-op.
 */
type SessionType = 'playback' | 'auto';

export function currentAudioSession(): string {
  if (typeof navigator === 'undefined') return 'unsupported';
  return (navigator as Navigator & { audioSession?: { type: string } }).audioSession?.type ?? 'unsupported';
}

export function setAudioSession(type: SessionType): void {
  if (typeof navigator === 'undefined') return;
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (!session) return;
  try {
    session.type = type;
  } catch {
    // Older Safari versions reject some types; default behaviour still applies.
  }
}
