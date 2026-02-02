'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Settings, BookOpen, MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceFABProps {
  onVoice: () => void;
  onSettings: () => void;
  onKnowledge: () => void;
  onChat?: () => void;
}

export function VoiceFAB({ onVoice, onSettings, onKnowledge, onChat }: VoiceFABProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 lg:hidden fab-container">
      <AnimatePresence>
        {expanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30"
              onClick={() => setExpanded(false)}
            />
            {/* Chat button */}
            {onChat && (
              <motion.button
                initial={{ scale: 0, y: 0 }}
                animate={{ scale: 1, y: -200 }}
                exit={{ scale: 0, y: 0 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  onChat();
                  setExpanded(false);
                }}
                className="absolute bottom-0 right-0 h-12 w-12 rounded-full bg-neon-primary/20 border border-neon-primary/30 flex items-center justify-center shadow-lg"
                aria-label="Open Chat"
              >
                <MessageCircle className="h-5 w-5" />
              </motion.button>
            )}
            {/* Voice button */}
            <motion.button
              initial={{ scale: 0, y: 0 }}
              animate={{ scale: 1, y: -136 }}
              exit={{ scale: 0, y: 0 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                onVoice();
                setExpanded(false);
              }}
              className="absolute bottom-0 right-0 h-12 w-12 rounded-full bg-neon-primary shadow-neon-primary/30 flex items-center justify-center shadow-lg"
              aria-label="Voice Mode"
            >
              <Mic className="h-5 w-5" />
            </motion.button>
            {/* Settings button */}
            <motion.button
              initial={{ scale: 0, y: 0 }}
              animate={{ scale: 1, y: -72 }}
              exit={{ scale: 0, y: 0 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                onSettings();
                setExpanded(false);
              }}
              className="absolute bottom-0 right-0 h-12 w-12 rounded-full bg-surface-2 border border-border-subtle flex items-center justify-center shadow-lg"
              aria-label="Open Settings"
            >
              <Settings className="h-5 w-5" />
            </motion.button>
            {/* Knowledge button */}
            <motion.button
              initial={{ scale: 0, x: 0 }}
              animate={{ scale: 1, x: -72 }}
              exit={{ scale: 0, x: 0 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                onKnowledge();
                setExpanded(false);
              }}
              className="absolute bottom-0 right-0 h-12 w-12 rounded-full bg-surface-2 border border-border-subtle flex items-center justify-center shadow-lg"
              aria-label="Open Knowledge Base"
            >
              <BookOpen className="h-5 w-5" />
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'relative h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-colors',
          expanded
            ? 'bg-surface-3 border border-border-subtle'
            : 'bg-neon-primary shadow-neon-primary/30'
        )}
        aria-label={expanded ? 'Close menu' : 'Open menu'}
      >
        {expanded ? <X className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
      </motion.button>
    </div>
  );
}
