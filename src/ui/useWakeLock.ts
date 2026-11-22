import { useEffect } from 'react';

/**
 * Keep the screen on while `active`. A phone on a music stand would otherwise dim and
 * lock mid-take. Browsers drop the lock when the tab is hidden, so it is re-acquired
 * when the tab comes back. Unsupported browsers are left alone.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) await next.release(); else lock = next;
      } catch {
        // Denied (for example, low battery mode). Practice still works.
      }
    }
    function handleVisibility() {
      if (document.visibilityState === 'visible') void acquire();
    }

    void acquire();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
