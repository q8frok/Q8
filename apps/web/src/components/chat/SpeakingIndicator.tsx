'use client';

import { motion } from 'framer-motion';
import { Volume2, Pause } from 'lucide-react';

interface SpeakingIndicatorProps {
  onStop?: () => void;
}

/**
 * Speaking indicator with animated waveform bars
 */
export function SpeakingIndicator({ onStop }: SpeakingIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neon-primary/10 border border-neon-primary/30"
    >
      {/* Pulsing speaker icon */}
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 0.8, repeat: Infinity }}
      >
        <Volume2 className="h-4 w-4 text-neon-primary" />
      </motion.div>

      {/* Animated waveform bars */}
      <div className="flex items-center gap-0.5 h-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="w-1 bg-neon-primary rounded-full"
            animate={{
              height: ['8px', '16px', '8px'],
            }}
            transition={{
              duration: 0.5,
              repeat: Infinity,
              delay: i * 0.1,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      <span className="text-xs text-neon-primary font-medium">Speaking</span>

      {/* Pause/Stop button */}
      {onStop && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStop();
          }}
          className="p-1 rounded-full hover:bg-neon-primary/20 transition-colors"
          title="Stop speaking"
        >
          <Pause className="h-3 w-3 text-neon-primary" />
        </button>
      )}
    </motion.div>
  );
}

SpeakingIndicator.displayName = 'SpeakingIndicator';
