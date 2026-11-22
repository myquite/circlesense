/**
 * iOS routes Web Audio through the "ambient" audio session by default, which the
 * ring/silent switch mutes. Declaring the session as playback makes the accompaniment
 * audible with the switch on silent. While the microphone is open the session has to be
 * play-and-record, or capture stops. Only Safari implements this; elsewhere it is a no-op.
 */
type SessionType = 'playback' | 'play-and-record';

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
