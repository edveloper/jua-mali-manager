import { useCallback, useEffect, useState } from 'react';

/** The three ways installing can go, from most to least automatic. */
export type InstallRoute = 'prompt' | 'ios' | 'none';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __installPrompt: BeforeInstallPromptEvent | null;
  }
}

const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // Safari's own flag, which predates the media query and is still what older
  // iOS versions set.
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * iPadOS reports itself as a Mac by default, so the old /iPad|iPhone|iPod/ test
 * missed every iPad and told those users their browser did not support
 * installing. A Mac with a touchscreen is the reliable tell that it is not one.
 */
export const isIosDevice = (): boolean => {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
};

export const isIpad = (): boolean =>
  /iPad/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/** Other iOS browsers can add to the home screen, but Safari is the sure route. */
export const isIosSafari = (): boolean =>
  isIosDevice() && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);

export const usePwaInstall = () => {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => (typeof window !== 'undefined' ? window.__installPrompt : null)
  );
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    // The event may have been caught in index.html before this mounted, so the
    // initial state reads window first and this only keeps it in step.
    const sync = () => {
      setPrompt(window.__installPrompt);
      setInstalled(isStandalone());
    };
    window.addEventListener('installpromptchange', sync);
    return () => window.removeEventListener('installpromptchange', sync);
  }, []);

  const route: InstallRoute = installed
    ? 'none'
    : prompt
      ? 'prompt'
      : isIosDevice()
        ? 'ios'
        : 'none';

  /**
   * Returns true when the browser handled it, false when the caller needs to
   * show instructions instead. Deliberately not throwing an alert from in here:
   * a hook should not be deciding what the interface looks like.
   */
  const install = useCallback(async (): Promise<boolean> => {
    if (!prompt) return false;

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;

    // A prompt can only be used once, accepted or not.
    window.__installPrompt = null;
    setPrompt(null);
    if (outcome === 'accepted') setInstalled(true);
    return true;
  }, [prompt]);

  return { route, install, isInstalled: installed, canInstall: route !== 'none' };
};
