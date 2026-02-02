'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Minimize2 } from 'lucide-react';
import { Button } from '../ui/button';
import { AudioVisualizer } from './AudioVisualizer';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/pwa/haptics';

interface VoiceOverlayProps {
  isActive: boolean;
  onToggle: () => void;
  /** Audio stream for visualizer */
  stream?: MediaStream;
  /** Real-time transcript text */
  transcript?: string;
  /** Currently active agent name */
  activeAgent?: string;
}

const SPRING = { type: 'spring' as const, stiffness: 400, damping: 35 };

export function VoiceOverlay({
  isActive,
  onToggle,
  stream,
  transcript,
  activeAgent,
}: VoiceOverlayProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [minimized, setMinimized] = useState(false);

  if (!isActive) return null;

  const handleMinimize = () => {
    haptics.light();
    setMinimized(true);
  };

  const handleExpand = () => {
    haptics.light();
    setMinimized(false);
  };

  const handleEnd = () => {
    haptics.medium();
    setMinimized(false);
    onToggle();
  };

  // Minimized floating pill
  if (minimized) {
    return (
      <motion.button
        initial={{ y: -20, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -20, opacity: 0, scale: 0.8 }}
        transition={SPRING}
        onClick={handleExpand}
        className="fixed top-[max(env(safe-area-inset-top,12px),12px)] left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-2)] border border-[var(--border-subtle)] shadow-lg"
      >
        <div className="flex gap-0.5">
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              className="w-0.5 rounded-full bg-neon-primary"
              animate={{
                height: [8, 16, 8],
              }}
              transition={{
                repeat: Infinity,
                duration: 0.6,
                delay: i * 0.1,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
        <span className="text-xs font-medium text-text-secondary">
          {isSpeaking ? 'Speaking...' : 'Listening...'}
        </span>
      </motion.button>
    );
  }

  // Full overlay
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl"
    >
      {/* Active agent indicator */}
      {activeAgent && (
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute top-[max(calc(env(safe-area-inset-top,12px)+12px),24px)] px-4 py-1.5 rounded-full bg-neon-primary/20 border border-neon-primary/30"
        >
          <span className="text-xs font-medium text-neon-primary">{activeAgent}</span>
        </motion.div>
      )}

      {/* Minimize button */}
      <button
        onClick={handleMinimize}
        className="absolute top-[max(calc(env(safe-area-inset-top,12px)+12px),24px)] right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
        aria-label="Minimize voice overlay"
      >
        <Minimize2 className="h-5 w-5 text-white/60" />
      </button>

      <div className="flex flex-col items-center gap-8 w-full max-w-sm px-4">
        <h2 className="text-3xl font-light text-white tracking-tight">
          {isSpeaking ? 'Q8 is speaking...' : 'Listening...'}
        </h2>

        {/* Real Audio Visualizer */}
        <AudioVisualizer
          stream={stream}
          style="bars"
          barCount={16}
          width={320}
          height={120}
          color="var(--color-neon-primary, #7c3aed)"
          showFrequencyLabels={false}
          className="w-full"
        />

        {/* Live transcript */}
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-h-24 overflow-y-auto scrollbar-thin"
          >
            <p className="text-sm text-white/70 text-center leading-relaxed">
              {transcript}
            </p>
          </motion.div>
        )}

        <Button
          variant="ghost"
          size="lg"
          onClick={handleEnd}
          className="px-8 py-3 rounded-full bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
        >
          <MicOff className="mr-2 h-4 w-4" />
          End Session
        </Button>
      </div>
    </motion.div>
  );
}
