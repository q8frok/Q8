'use client';

import { useState, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/pwa/haptics';
import { useVoiceInput } from '@/hooks/useVoiceInput';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export function VoiceInputButton({ onTranscript, className }: VoiceInputButtonProps) {
  const {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput({ continuous: false, interimResults: true });

  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (transcript) {
      onTranscript(transcript);
      resetTranscript();
      setShowTranscript(false);
    }
  }, [transcript, onTranscript, resetTranscript]);

  useEffect(() => {
    if (interimTranscript) {
      setShowTranscript(true);
    }
  }, [interimTranscript]);

  const handleToggle = () => {
    if (isListening) {
      stopListening();
      haptics.light();
    } else {
      const success = startListening();
      if (success) {
        haptics.medium();
      } else {
        haptics.error();
      }
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className={cn(
          'p-2 rounded-lg transition-all',
          isListening
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse'
            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80',
          className
        )}
        title={isListening ? 'Stop recording' : 'Start voice input'}
      >
        {isListening ? (
          <MicOff className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>

      {/* Interim Transcript Display */}
      {showTranscript && interimTranscript && (
        <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg shadow-lg min-w-[200px] max-w-[300px]">
          <p className="text-xs text-white/80">{interimTranscript}</p>
          <div className="mt-1 flex items-center gap-1">
            <Loader2 className="w-3 h-3 text-neon-primary animate-spin" />
            <span className="text-xs text-white/60">Listening...</span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg shadow-lg">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
