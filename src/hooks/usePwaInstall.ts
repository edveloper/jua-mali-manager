import { useState, useEffect } from 'react';

export const usePwaInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed/running in standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) {
      // Logic for iOS or already installed
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        alert("To install on iPhone: \n1. Tap the 'Share' icon (square with arrow) \n2. Scroll down and tap 'Add to Home Screen' 📲");
      } else {
        alert("App is already installed or your browser doesn't support one-click install.");
      }
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return { installApp, canInstall: !!deferredPrompt || (!isInstalled && /iPad|iPhone|iPod/.test(navigator.userAgent)) };
};