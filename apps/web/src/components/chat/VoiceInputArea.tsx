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
    <div className="flex flex-col items-center gap-3 py-4">
      <motion.button
        onClick={onVoiceInteraction}
        disabled={isTranscribing}
        className={cn(
          'relative h-16 w-16 rounded-full flex items-center justify-center transition-all',
          'shadow-lg focus-ring',
          isRecording && 'bg-red-500 scale-110',
          isSpeaking && 'bg-green-500',
          isTranscribing && 'bg-blue-500',
          !isRecording && !isSpeaking && !isTranscribing && 'bg-neon-primary hover:bg-neon-primary/90'
        )}
        whileTap={{ scale: 0.95 }}
      >
        {/* Pulsing ring when recording */}
        {isRecording && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-red-400"
            animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
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
      <p className="text-sm text-text-muted text-center">
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
