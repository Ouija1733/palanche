import { Capacitor, SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Keeps the icons of the Android system bars readable: dark icons on the
 * light theme, light icons on the dark theme.
 *
 * The app is drawn edge to edge (behind the status bar and the navigation
 * bar); the pages leave room for the bars with the `--ion-safe-area-*`
 * variables, which Ionic fills from the insets that Capacitor injects.
 * The status bar uses the status-bar plugin; the navigation bar (three-button
 * mode) uses SystemBars from @capacitor/core, since the status-bar plugin
 * does not touch it.
 */
export function initSystemBars(): void {
  if (!Capacitor.isNativePlatform()) {
    return;
  }
  const media = window.matchMedia(DARK_QUERY);
  void applyStyle(media.matches);
  // The theme follows the system: update the icons when the user switches it.
  media.addEventListener('change', (event) => void applyStyle(event.matches));
}

async function applyStyle(dark: boolean): Promise<void> {
  try {
    // Style.Dark = light icons, for a dark background.
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await SystemBars.setStyle({
      style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
      bar: SystemBarType.NavigationBar,
    });
  } catch {
    // Cosmetic only: never break the app because a bar could not be styled.
  }
}
