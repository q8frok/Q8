'use client';

import { motion } from 'framer-motion';
import { Mic, MicOff, Keyboard, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface VoiceInputAreaProps {
  isRecording: boolean;
  isTranscribing: boolean;
  isSpeaking: boolean;
  isLoading: boolean;
  onVoiceInteraction: () => void;
  onSwitchToText: () => void;
}

export function VoiceInputArea({
  isRecording,
  isTranscribing,
  isSpeaking,
  isLoading,
  onVoiceInteraction,
  onSwitchToText,
}: VoiceInputAreaProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
      <motion.button
        onClick={onVoiceInteraction}
        disabled={isTranscribing}
        className={cn(
          'relative h-16 w-16 rounded-full flex items-center justify-center transition-all will-change-transform',
          'shadow-lg focus-ring',
          isRecording && 'bg-red-500 scale-110',
          isSpeaking && 'bg-green-500',
          isTranscribing && 'bg-blue-500',
          !isRecording && !isSpeaking && !isTranscribing && 'bg-neon-primary hover:bg-neon-primary/90'
        )}
        whileTap={{ scale: 0.95 }}
      >
        {/* Concentric ripple rings when recording */}
        {isRecording && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-red-400"
              animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
              style={{ willChange: 'transform, opacity' }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border border-red-400/50"
              animate={{ scale: [1, 1.7], opacity: [0.4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
              style={{ willChange: 'transform, opacity' }}
            />
          </>
        )}

        {isRecording ? (
          <MicOff className="h-6 w-6 text-white" />
        ) : isTranscribing ? (
          <Loader2 className="h-6 w-6 text-white animate-spin" />
        ) : (
          <Mic className="h-6 w-6 text-white" />
        )}
      </motion.button>

      {/* Status text */}
      <p className="text-base sm:text-sm text-text-muted text-center font-medium">
        {isRecording && 'Listening... Release to send'}
        {isTranscribing && 'Processing...'}
        {isSpeaking && 'Speaking...'}
        {isLoading && !isTranscribing && 'Thinking...'}
        {!isRecording && !isTranscribing && !isSpeaking && !isLoading && 'Tap or press Space to speak'}
      </p>

      {/* Quick switch to text */}
      <Button variant="ghost" size="sm" onClick={onSwitchToText} className="text-xs gap-1">
        <Keyboard className="h-3 w-3" />
        Switch to Text
      </Button>
    </div>
  );
}
