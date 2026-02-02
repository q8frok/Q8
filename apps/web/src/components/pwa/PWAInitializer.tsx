'use client';

import { useEffect, useState, useCallback } from 'react';
import { registerServiceWorker } from '@/lib/pwa/service-worker-registration';
import { useViewportHeight } from '@/hooks/useViewportHeight';
import { haptics } from '@/lib/pwa/haptics';
import { InstallPrompt } from './InstallPrompt';
import { UpdateToast } from './UpdateToast';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Central PWA initialization component.
 * - Registers service worker with non-blocking update flow
 * - Manages viewport height (iOS keyboard-aware --vh)
 * - Captures install prompt events
 * - Listens for online/offline transitions with haptic feedback
 * - Renders InstallPrompt and UpdateToast children
 */
export function PWAInitializer() {
  // Global viewport height hook (sets --vh CSS custom property)
  useViewportHeight();

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [pendingWorker, setPendingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdateToast, setShowUpdateToast] = useState(false);

  // Prevent pull-to-refresh on mobile
  useEffect(() => {
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) startY = touch.pageY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const y = touch.pageY;
      // Prevent pull-to-refresh when at top of page and pulling down
      if (document.scrollingElement?.scrollTop === 0 && y > startY) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Service worker registration
  useEffect(() => {
    registerServiceWorker({
      onUpdate: (worker) => {
        setPendingWorker(worker);
        setShowUpdateToast(true);
      },
    });
  }, []);

  // Capture beforeinstallprompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Listen for successful install
  useEffect(() => {
    const handler = () => {
      haptics.success();
      setInstallPrompt(null);
    };

    window.addEventListener('appinstalled', handler);
    return () => window.removeEventListener('appinstalled', handler);
  }, []);

  // Online/offline haptic feedback
  useEffect(() => {
    const handleOnline = () => haptics.success();
    const handleOffline = () => haptics.warning();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle SW update action
  const handleUpdate = useCallback(() => {
    if (pendingWorker) {
      pendingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    setShowUpdateToast(false);
  }, [pendingWorker]);

  const handleDismissUpdate = useCallback(() => {
    setShowUpdateToast(false);
  }, []);

  const handleDismissInstall = useCallback(() => {
    setInstallPrompt(null);
  }, []);

  // Check if running in standalone mode (already installed)
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone));

  return (
    <>
      {!isStandalone && (
        <InstallPrompt prompt={installPrompt} onDismiss={handleDismissInstall} />
      )}
      <UpdateToast
        show={showUpdateToast}
        onUpdate={handleUpdate}
        onDismiss={handleDismissUpdate}
      />
    </>
  );
}
