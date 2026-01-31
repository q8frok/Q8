/**
 * Mobile Utilities
 * Device detection and mobile-specific helpers
 */

export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android/.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function getViewportHeight(): number {
  if (typeof window === 'undefined') return 0;
  return window.visualViewport?.height || window.innerHeight;
}

export function getViewportWidth(): number {
  if (typeof window === 'undefined') return 0;
  return window.visualViewport?.width || window.innerWidth;
}

export function getSafeAreaInsets() {
  if (typeof window === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  // env() values can't be read directly via getComputedStyle.
  // We read them from CSS custom properties set in globals.css:
  //   --safe-area-top: env(safe-area-inset-top, 0px);
  const style = getComputedStyle(document.documentElement);
  return {
    top: parseFloat(style.getPropertyValue('--safe-area-top')) || 0,
    right: parseFloat(style.getPropertyValue('--safe-area-right')) || 0,
    bottom: parseFloat(style.getPropertyValue('--safe-area-bottom')) || 0,
    left: parseFloat(style.getPropertyValue('--safe-area-left')) || 0,
  };
}

export function preventPullToRefresh() {
  if (typeof document === 'undefined') return;

  let lastTouchY = 0;
  let preventPullToRefresh = false;

  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (!touch) return;
      lastTouchY = touch.clientY;
      preventPullToRefresh = window.scrollY === 0;
    },
    { passive: false }
  );

  document.addEventListener(
    'touchmove',
    (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      const touchY = touch.clientY;
      const touchYDelta = touchY - lastTouchY;
      lastTouchY = touchY;

      if (preventPullToRefresh && touchYDelta > 0) {
        e.preventDefault();
        return;
      }
    },
    { passive: false }
  );
}

export const mobile = {
  isMobile,
  isIOS,
  isAndroid,
  isStandalone,
  getViewportHeight,
  getViewportWidth,
  getSafeAreaInsets,
  preventPullToRefresh,
};
