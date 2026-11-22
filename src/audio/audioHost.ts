/**
 * Owns the app's one AudioContext and the rules around it, so they live in one place:
 *
 *  1. Session. iOS mutes Web Audio with the ring/silent switch unless the page declares a
 *     'playback' session, but Safari refuses microphone capture in a playback-only
 *     session. So the session is 'auto' exactly while a microphone is open, and
 *     'playback' otherwise. Only Safari implements this; elsewhere it is a no-op.
 *
 *  2. Wakefulness. Browsers park the context ('suspended', or 'interrupted' on iOS after
 *     a call, another app, or an audio-route change such as the microphone opening).
 *     While output is wanted the host resumes it whenever it stops, and `wake()` can be
 *     called from any user gesture.
 *
 * The conductor says when output is wanted; the microphone says when it is capturing.
 * Neither touches the session or the context state directly.
 */
export type AudioSessionType = 'playback' | 'auto';

interface SessionCarrier { audioSession?: { type: string } }

export class AudioHost {
  readonly context: AudioContext;
  private captures = 0;
  private outputWanted = false;

  constructor() {
    this.context = new AudioContext();
    this.applySession();
    this.context.addEventListener?.('statechange', () => {
      if (this.outputWanted) this.wake();
    });
  }

  /** The session the current state calls for. */
  get session(): AudioSessionType {
    return this.captures > 0 ? 'auto' : 'playback';
  }

  /** Resume the context if the browser has parked it. Safe to call from any user gesture. */
  wake(): void {
    if (this.context.state !== 'running') void this.context.resume().catch(() => {});
  }

  /** The transport is running (or has stopped): keep output alive, or stop insisting. */
  setOutputWanted(wanted: boolean): void {
    this.outputWanted = wanted;
    if (wanted) this.wake();
  }

  /**
   * A microphone is about to be requested. Call before getUserMedia, and call the
   * returned function once when the capture ends or the request fails.
   */
  beginCapture(): () => void {
    this.captures++;
    this.applySession();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.captures--;
      this.applySession();
    };
  }

  /** For the ?debug readout. */
  describe(): string {
    const applied = typeof navigator === 'undefined' ? undefined : (navigator as SessionCarrier).audioSession?.type;
    return `audio ${this.context.state} · ${this.context.sampleRate} Hz · session ${applied ?? 'unsupported'} (wants ${this.session})`;
  }

  private applySession(): void {
    if (typeof navigator === 'undefined') return;
    const session = (navigator as SessionCarrier).audioSession;
    if (!session) return;
    try {
      session.type = this.session;
    } catch {
      // Older Safari versions reject some types; default behaviour still applies.
    }
  }
}
