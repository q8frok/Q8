'use client';

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { haptics } from '@/lib/pwa/haptics';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPromptProps {
  prompt: BeforeInstallPromptEvent | null;
  onDismiss: () => void;
}

const DISMISS_KEY = 'q8-install-dismissed';
const MAX_DISMISSALS = 3;

export function getDismissCount(): number {
  if (typeof window === 'undefined') return MAX_DISMISSALS;
  return parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
}

function incrementDismissCount(): void {
  const count = getDismissCount() + 1;
  localStorage.setItem(DISMISS_KEY, String(count));
}

export function InstallPrompt({ prompt, onDismiss }: InstallPromptProps) {
  const visible = prompt !== null && getDismissCount() < MAX_DISMISSALS;

  const handleInstall = useCallback(async () => {
    if (!prompt) return;
    haptics.medium();
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      haptics.success();
    }
    onDismiss();
  }, [prompt, onDismiss]);

  const handleDismiss = useCallback(() => {
    haptics.selection();
    incrementDismissCount();
    onDismiss();
  }, [onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-50 px-4"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="surface-matte rounded-xl p-4 shadow-lg border border-[var(--border-subtle)] max-w-md mx-auto">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--color-neon-primary)]/20 flex items-center justify-center">
                  <Download className="h-5 w-5 text-[var(--color-neon-primary)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    Add Q8 to Home Screen
                  </p>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    Quick access, works offline
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleInstall}
                  className="btn-solid text-xs px-3 py-1.5"
                >
                  Install
                </button>
                <button
                  onClick={handleDismiss}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-4)] transition-colors"
                  aria-label="Dismiss install prompt"
                >
                  <X className="h-4 w-4 text-[var(--text-muted)]" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
