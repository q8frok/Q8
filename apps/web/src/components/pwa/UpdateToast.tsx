'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { haptics } from '@/lib/pwa/haptics';

interface UpdateToastProps {
  show: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 30_000;

export function UpdateToast({ show, onUpdate, onDismiss }: UpdateToastProps) {
  useEffect(() => {
    if (!show) return;
    haptics.light();
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [show, onDismiss]);

  const handleUpdate = () => {
    haptics.success();
    onUpdate();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-4 right-4 z-50"
        >
          <div className="surface-matte rounded-xl p-4 shadow-lg border border-[var(--border-subtle)] max-w-xs">
            <div className="flex items-start gap-3">
              <RefreshCw className="h-5 w-5 text-[var(--color-info)] flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Update Available
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  A new version of Q8 is ready.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={handleUpdate} className="btn-solid text-xs px-3 py-1.5">
                    Update Now
                  </button>
                  <button
                    onClick={onDismiss}
                    className="btn-ghost text-xs px-3 py-1.5"
                  >
                    Later
                  </button>
                </div>
              </div>
              <button
                onClick={onDismiss}
                className="p-1 rounded hover:bg-[var(--surface-4)] transition-colors"
                aria-label="Dismiss update notification"
              >
                <X className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
