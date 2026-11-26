/**
 * Launched from the iOS home screen with a translucent status bar, iOS can report a
 * viewport shorter than the screen by about the status bar's height, so the app stops
 * short and leaves a band at the bottom. CSS cannot see past the viewport, so in that
 * case the shell is sized to the screen through --app-height.
 */
const MAX_SHORTFALL = 100; // a status bar's worth; bigger gaps are real windows (iPad split view)

/** How tall the app should be, or null when the viewport already fits. Exported for tests. */
export function homeScreenHeight(
  screenWidth: number,
  screenHeight: number,
  innerWidth: number,
  innerHeight: number,
): number | null {
  // iOS keeps screen dimensions in portrait; pick the side that matches the window's orientation.
  const tall = innerHeight >= innerWidth;
  const expected = tall ? Math.max(screenWidth, screenHeight) : Math.min(screenWidth, screenHeight);
  const shortfall = expected - innerHeight;
  return shortfall > 0 && shortfall <= MAX_SHORTFALL ? expected : null;
}

export function fitHomeScreenViewport(): void {
  // Only iOS home-screen apps set navigator.standalone; Safari tabs and other platforms are left alone.
  if ((navigator as { standalone?: boolean }).standalone !== true) return;
  const apply = () => {
    const height = homeScreenHeight(screen.width, screen.height, window.innerWidth, window.innerHeight);
    document.documentElement.style.setProperty('--app-height', height === null ? '' : `${height}px`);
  };
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
}
