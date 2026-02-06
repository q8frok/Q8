'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Loader2, AlertCircle, Volume2, Square, Zap, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoice, type Voice } from '@/hooks/useVoice';
import { useRealtimeVoice } from '@/hooks/useRealtimeVoice';
import { logger } from '@/lib/logger';

interface VoiceButtonEnhancedProps {
  /** Callback with transcribed text */
  onTranscription?: (text: string) => void;
  /** Callback when voice input should trigger a message send */
  onSend?: (text: string) => void;
  /** Text to speak (for TTS responses) — only used in HTTP mode */
  speakText?: string;
  /** Auto-speak responses — only used in HTTP mode */
  autoSpeak?: boolean;
  /** Voice for TTS */
  voice?: Voice;
  /** Enable push-to-talk (Space bar) — only used in HTTP mode */
  enablePushToTalk?: boolean;
  /** Button size */
  size?: 'sm' | 'default' | 'lg';
  /** Show status text */
  showStatusText?: boolean;
  /** Use WebRTC realtime mode */
  useWebRTC?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * VoiceButtonEnhanced Component
 *
 * Full voice interaction with recording, transcription, and TTS.
 * Supports WebRTC realtime mode (sub-500ms latency) and HTTP fallback.
 */
export function VoiceButtonEnhanced({
  onTranscription,
  onSend,
  speakText,
  autoSpeak = true,
  voice = 'nova',
  enablePushToTalk = true,
  size = 'default',
  showStatusText = true,
  useWebRTC = false,
  className,
}: VoiceButtonEnhancedProps) {
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const [mode, setMode] = useState<'webrtc' | 'http'>(useWebRTC ? 'webrtc' : 'http');

  // ── WebRTC Realtime Mode ──────────────────────────────────────────────
  const {
    state: realtimeState,
    isConnected: rtcConnected,
    isSpeaking: rtcSpeaking,
    isListening: rtcListening,
    connect: rtcConnect,
    disconnect: rtcDisconnect,
    interrupt: rtcInterrupt,
    lastTranscript: rtcTranscript,
    error: rtcError,
  } = useRealtimeVoice({
    voice,
    onTranscript: (text, isFinal) => {
      if (isFinal && text.trim()) {
        onTranscription?.(text);
        if (onSend) onSend(text);
      }
    },
    onError: (error) => {
      logger.error('WebRTC voice error', { error, component: 'VoiceButtonEnhanced' });
    },
    onFallback: (reason) => {
      logger.warn('WebRTC unavailable, switching to HTTP voice mode', {
        reason,
        component: 'VoiceButtonEnhanced',
      });
      setMode('http');
    },
  });

  // ── HTTP Fallback Mode ────────────────────────────────────────────────
  const {
    status,
    isRecording,
    isTranscribing: _isTranscribing,
    isSpeaking: httpSpeaking,
    transcript,
    error,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording: _cancelRecording,
    speak,
    stopSpeaking,
  } = useVoice({
    voice,
    onTranscription: (text) => {
      onTranscription?.(text);
      if (onSend && text.trim()) onSend(text);
    },
    onError: (err) => {
      logger.error('Voice button error', { error: err, component: 'VoiceButtonEnhanced' });
    },
  });

  // ── Derived State ─────────────────────────────────────────────────────
  const isWebRTC = mode === 'webrtc';
  const isSpeakingNow = isWebRTC ? rtcSpeaking : httpSpeaking;
  const isListeningNow = isWebRTC ? rtcListening : isRecording;
  const isProcessingNow = isWebRTC
    ? realtimeState === 'connecting'
    : status === 'transcribing' || status === 'processing' || status === 'requesting-permission';
  const currentTranscript = isWebRTC ? rtcTranscript : transcript;
  const currentError = isWebRTC ? rtcError : error;
  const effectiveStatus = isWebRTC ? realtimeState : status;

  // Auto-speak when speakText changes (HTTP mode only)
  useEffect(() => {
    if (!isWebRTC && autoSpeak && speakText && !httpSpeaking && status === 'idle') {
      speak(speakText);
    }
  }, [speakText, autoSpeak, httpSpeaking, status, speak, isWebRTC]);

  // Handle click
  const handleClick = useCallback(async () => {
    if (isWebRTC) {
      if (rtcConnected) {
        if (rtcSpeaking) {
          rtcInterrupt();
        } else {
          rtcDisconnect();
        }
      } else {
        rtcConnect();
      }
      return;
    }

    // HTTP mode
    if (httpSpeaking) {
      stopSpeaking();
      return;
    }
    if (isRecording) {
      await stopRecording();
    } else if (status === 'idle' || status === 'error') {
      await startRecording();
    }
  }, [isWebRTC, rtcConnected, rtcSpeaking, rtcInterrupt, rtcConnect, rtcDisconnect,
      httpSpeaking, isRecording, status, startRecording, stopRecording, stopSpeaking]);

  // Keyboard shortcuts (Space bar for push-to-talk — HTTP mode only)
  useEffect(() => {
    if (!enablePushToTalk || isWebRTC) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !e.repeat &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        if (!isRecording && !isPushToTalkActive && status === 'idle') {
          setIsPushToTalkActive(true);
          startRecording();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isPushToTalkActive) {
        e.preventDefault();
        setIsPushToTalkActive(false);
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enablePushToTalk, isWebRTC, isRecording, isPushToTalkActive, status, startRecording, stopRecording]);

  // Size variants
  const sizeClasses = {
    sm: 'h-10 w-10',
    default: 'h-14 w-14',
    lg: 'h-20 w-20',
  };

  const iconSizeClasses = {
    sm: 'h-5 w-5',
    default: 'h-7 w-7',
    lg: 'h-10 w-10',
  };

  // Status colors
  const getStatusColor = () => {
    if (isWebRTC) {
      if (rtcConnected && !rtcSpeaking && !rtcListening) return 'bg-emerald-500 text-white';
      if (rtcListening) return 'bg-red-500 text-white';
      if (rtcSpeaking) return 'bg-green-500 text-white';
      if (realtimeState === 'connecting') return 'bg-yellow-500 text-white';
      if (realtimeState === 'error' || realtimeState === 'fallback') return 'bg-red-600 text-white';
      return 'bg-neon-primary text-white';
    }
    const statusColors: Record<string, string> = {
      idle: 'bg-neon-primary text-white',
      'requesting-permission': 'bg-yellow-500 text-white',
      recording: 'bg-red-500 text-white',
      transcribing: 'bg-blue-500 text-white',
      processing: 'bg-blue-500 text-white',
      speaking: 'bg-green-500 text-white',
      error: 'bg-red-600 text-white',
    };
    return statusColors[status] || 'bg-neon-primary text-white';
  };

  // Status text
  const getStatusText = () => {
    if (isWebRTC) {
      if (realtimeState === 'connecting') return 'Connecting...';
      if (rtcConnected && !rtcSpeaking && !rtcListening) return 'Connected — speak naturally';
      if (rtcListening) return 'Hearing you...';
      if (rtcSpeaking) return 'Speaking... Tap to interrupt';
      if (realtimeState === 'error') return rtcError || 'Connection error';
      if (realtimeState === 'fallback') return 'Realtime unavailable — using standard voice';
      return 'Tap to connect';
    }
    const texts: Record<string, string> = {
      idle: enablePushToTalk ? 'Hold Space or click to talk' : 'Click to talk',
      'requesting-permission': 'Requesting microphone...',
      recording: 'Recording... Release to send',
      transcribing: 'Transcribing...',
      processing: 'Processing...',
      speaking: 'Speaking... Click to stop',
      error: error || 'Error occurred',
    };
    return texts[status] || '';
  };

  // Get icon based on state
  const getIcon = () => {
    if (isProcessingNow) {
      return <Loader2 className={cn(iconSizeClasses[size], 'animate-spin')} />;
    }
    if (isSpeakingNow) {
      return <Volume2 className={iconSizeClasses[size]} />;
    }
    if (currentError && !isWebRTC) {
      return <AlertCircle className={iconSizeClasses[size]} />;
    }
    if (isWebRTC && rtcConnected) {
      return <Zap className={iconSizeClasses[size]} />;
    }
    if (isWebRTC && !rtcConnected && realtimeState === 'error') {
      return <WifiOff className={iconSizeClasses[size]} />;
    }
    if (isListeningNow) {
      return <Square className={iconSizeClasses[size]} />;
    }
    return <Mic className={iconSizeClasses[size]} />;
  };

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {/* Voice Button */}
      <div className="relative">
        <motion.button
          onClick={handleClick}
          disabled={isProcessingNow && !isWebRTC}
          className={cn(
            'relative rounded-full flex items-center justify-center transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-neon-primary focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            sizeClasses[size],
            getStatusColor()
          )}
          whileTap={{ scale: 0.95 }}
          animate={isListeningNow ? { scale: [1, 1.05, 1] } : {}}
          transition={isListeningNow ? { duration: 0.5, repeat: Infinity } : {}}
          aria-label={
            isWebRTC
              ? rtcConnected ? 'Disconnect realtime voice' : 'Connect realtime voice'
              : isRecording ? 'Stop recording' : 'Start recording'
          }
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={String(effectiveStatus)}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
            >
              {getIcon()}
            </motion.div>
          </AnimatePresence>
        </motion.button>

        {/* Audio Level Indicator (Recording / Listening) */}
        <AnimatePresence>
          {isListeningNow && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-red-500"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{
                  scale: 1 + (isWebRTC ? 0.3 : audioLevel * 0.5),
                  opacity: 0.8 - (isWebRTC ? 0.3 : audioLevel * 0.5),
                }}
                transition={{ duration: 0.1 }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-red-500"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
              />
            </>
          )}
        </AnimatePresence>

        {/* Speaking Indicator */}
        <AnimatePresence>
          {isSpeakingNow && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-green-500"
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0.4, 0.8] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </AnimatePresence>

        {/* WebRTC Connected Indicator */}
        <AnimatePresence>
          {isWebRTC && rtcConnected && !isListeningNow && !isSpeakingNow && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-emerald-500/50"
              initial={{ scale: 1, opacity: 0.4 }}
              animate={{ scale: 1.2, opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Status Text */}
      {showStatusText && (
        <motion.p
          key={getStatusText()}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'text-sm text-center max-w-[200px]',
            currentError ? 'text-red-400' : 'text-text-muted'
          )}
        >
          {getStatusText()}
        </motion.p>
      )}

      {/* Transcript Preview */}
      {currentTranscript && !isListeningNow && !isSpeakingNow && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-text-muted text-center max-w-[200px] truncate"
        >
          &ldquo;{currentTranscript}&rdquo;
        </motion.div>
      )}
    </div>
  );
}

VoiceButtonEnhanced.displayName = 'VoiceButtonEnhanced';
