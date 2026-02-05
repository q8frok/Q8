'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Mic,
  Volume2,
  VolumeX,
  Settings,
  MessageSquare,
  Bot,
  Sparkles,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoice, type Voice } from '@/hooks/useVoice';
import { useRealtimeVoice } from '@/hooks/useRealtimeVoice';
import { useChat } from '@/hooks/useChat';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

interface VoiceConversationProps {
  /** Whether the voice conversation is open */
  isOpen: boolean;
  /** Callback to close the voice conversation */
  onClose: () => void;
  /** User ID for chat */
  userId: string;
  /** Thread ID for chat */
  threadId: string;
  /** TTS Voice */
  voice?: Voice;
  /** Use WebRTC realtime mode (sub-500ms latency) */
  useWebRTC?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface ConversationEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * VoiceConversation Component
 *
 * Full-screen ambient voice conversation mode.
 * Supports two modes:
 * - WebRTC (default): Direct bidirectional audio via OpenAI Realtime API (<500ms latency)
 * - HTTP fallback: Record → transcribe → chat → TTS (2-4s latency)
 */
export function VoiceConversation({
  isOpen,
  onClose,
  userId,
  threadId,
  voice = 'nova',
  useWebRTC = true,
  className,
}: VoiceConversationProps) {
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<Voice>(voice);
  const [mode, setMode] = useState<'webrtc' | 'http'>(useWebRTC ? 'webrtc' : 'http');
  const lastResponseRef = useRef<string | null>(null);

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
    lastResponse: rtcResponse,
    latencyMs,
    error: rtcError,
  } = useRealtimeVoice({
    voice: selectedVoice,
    instructions: 'You are Q8, a helpful AI personal assistant. Be concise, friendly, and conversational.',
    onTranscript: (text, isFinal) => {
      if (isFinal && text.trim()) {
        addEntry('user', text);
      }
    },
    onResponse: (text) => {
      if (text.trim()) {
        addEntry('assistant', text);
      }
    },
    onError: (error) => {
      logger.error('WebRTC voice error', { error, component: 'VoiceConversation' });
      // Fall back to HTTP mode on WebRTC failure
      if (mode === 'webrtc') {
        setMode('http');
      }
    },
    onStateChange: (newState) => {
      logger.debug('Realtime voice state changed', { state: newState });
    },
  });

  // ── HTTP Fallback Mode ────────────────────────────────────────────────
  const {
    status: voiceStatus,
    isRecording,
    isSpeaking: httpSpeaking,
    audioLevel,
    startRecording,
    stopRecording,
    speak,
    stopSpeaking,
  } = useVoice({
    voice: selectedVoice,
    onTranscription: handleTranscription,
    onError: (error) => {
      logger.error('HTTP voice error', { error, component: 'VoiceConversation' });
    },
  });

  const {
    isLoading,
    isStreaming,
    currentAgent,
    sendMessage,
  } = useChat({
    userId,
    threadId,
    onMessage: handleAgentResponse,
  });

  // ── Shared Helpers ────────────────────────────────────────────────────
  function addEntry(role: 'user' | 'assistant', content: string) {
    const entry: ConversationEntry = {
      id: `voice_${Date.now()}_${role}`,
      role,
      content,
      timestamp: new Date(),
    };
    setConversationHistory(prev => [...prev, entry]);
  }

  /** HTTP mode: handle transcribed speech */
  async function handleTranscription(text: string) {
    if (!text.trim()) return;
    addEntry('user', text);
    await sendMessage(text);
  }

  /** HTTP mode: handle agent response */
  function handleAgentResponse(message: { content: string }) {
    if (!message.content || message.content === lastResponseRef.current) return;
    lastResponseRef.current = message.content;
    addEntry('assistant', message.content);
    if (!isMuted) {
      speak(message.content);
    }
  }

  // ── Connection Lifecycle ──────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && mode === 'webrtc' && !rtcConnected && realtimeState === 'idle') {
      rtcConnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen) {
      if (mode === 'webrtc' && rtcConnected) {
        rtcDisconnect();
      }
    }
  }, [isOpen, mode, rtcConnected, rtcDisconnect]);

  // ── Interaction Handler ───────────────────────────────────────────────
  const handleInteraction = useCallback(async () => {
    if (mode === 'webrtc') {
      // In WebRTC mode, tapping interrupts if AI is speaking
      if (rtcSpeaking) {
        rtcInterrupt();
      }
      // Otherwise no action needed — server VAD handles recording automatically
      return;
    }

    // HTTP mode
    if (httpSpeaking) {
      stopSpeaking();
      return;
    }
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [mode, rtcSpeaking, rtcInterrupt, httpSpeaking, isRecording, startRecording, stopRecording, stopSpeaking]);

  // ── Keyboard Shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mode === 'http' && isRecording) {
          stopRecording();
        } else {
          onClose();
        }
      } else if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        handleInteraction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, isRecording, handleInteraction, stopRecording, onClose]);

  // ── Derived State ─────────────────────────────────────────────────────
  const isWebRTC = mode === 'webrtc';
  const isActive = isWebRTC
    ? rtcConnected
    : voiceStatus !== 'idle' || isLoading || isStreaming;
  const isSpeakingNow = isWebRTC ? rtcSpeaking : httpSpeaking;
  const isListeningNow = isWebRTC ? rtcListening : isRecording;
  const isProcessing = isWebRTC
    ? realtimeState === 'connecting'
    : isLoading || isStreaming || voiceStatus === 'transcribing';
  const currentError = isWebRTC ? rtcError : null;
  const activeAgentName = isWebRTC ? 'Q8 (Realtime)' : currentAgent;

  // ── Status Text ───────────────────────────────────────────────────────
  const getStatusText = () => {
    if (currentError) return currentError;
    if (isWebRTC) {
      switch (realtimeState) {
        case 'connecting': return 'Connecting to realtime voice...';
        case 'connected': return 'Listening — just speak naturally';
        case 'speaking': return 'Q8 is responding... Tap to interrupt';
        case 'listening': return 'Hearing you...';
        case 'error': return rtcError || 'Connection error';
        default: return 'Initializing...';
      }
    }
    if (isRecording) return 'Listening...';
    if (voiceStatus === 'transcribing') return 'Processing...';
    if (isLoading) return 'Thinking...';
    if (isStreaming) return 'Responding...';
    if (httpSpeaking) return 'Speaking...';
    return 'Tap or hold Space to speak';
  };

  // ── Orb Color ─────────────────────────────────────────────────────────
  const getOrbColors = () => {
    if (isListeningNow) return 'from-red-500 to-red-600';
    if (isSpeakingNow) return 'from-green-500 to-green-600';
    if (isProcessing) return 'from-blue-500 to-blue-600';
    if (isWebRTC && rtcConnected) return 'from-emerald-500 to-teal-600';
    return 'from-neon-primary to-purple-600';
  };

  // Voice options
  const voiceOptions: { value: Voice; label: string }[] = [
    { value: 'nova', label: 'Nova (Friendly)' },
    { value: 'alloy', label: 'Alloy (Neutral)' },
    { value: 'echo', label: 'Echo (Warm)' },
    { value: 'fable', label: 'Fable (Expressive)' },
    { value: 'onyx', label: 'Onyx (Deep)' },
    { value: 'shimmer', label: 'Shimmer (Gentle)' },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn(
          'fixed inset-0 z-50 flex flex-col',
          'bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900',
          className
        )}
      >
        {/* Header */}
        <header className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-neon-primary/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-neon-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                Voice Mode
                {isWebRTC && (
                  <span className="flex items-center gap-1 text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                    <Zap className="h-3 w-3" />
                    Realtime
                  </span>
                )}
              </h1>
              <p className="text-sm text-text-muted flex items-center gap-1.5">
                {isWebRTC ? (
                  rtcConnected ? (
                    <>
                      <Wifi className="h-3 w-3 text-emerald-400" />
                      Connected
                      {latencyMs !== null && (
                        <span className="text-xs text-text-muted">({latencyMs}ms)</span>
                      )}
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 text-yellow-400" />
                      {realtimeState === 'connecting' ? 'Connecting...' : 'Disconnected'}
                    </>
                  )
                ) : (
                  activeAgentName ? `Talking to ${activeAgentName}` : 'Q8 is listening'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const newMode = mode === 'webrtc' ? 'http' : 'webrtc';
                if (mode === 'webrtc' && rtcConnected) rtcDisconnect();
                setMode(newMode);
              }}
              title={mode === 'webrtc' ? 'Switch to HTTP mode' : 'Switch to Realtime mode'}
              className="text-xs gap-1"
            >
              {mode === 'webrtc' ? <Zap className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
              {mode === 'webrtc' ? 'Realtime' : 'HTTP'}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Close"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-6 pb-4"
            >
              <div className="surface-matte rounded-xl p-4">
                <h3 className="text-sm font-medium mb-3">Voice Settings</h3>
                <div className="flex flex-wrap gap-2">
                  {voiceOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedVoice(option.value)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-sm transition-colors',
                        selectedVoice === option.value
                          ? 'bg-neon-primary text-white'
                          : 'bg-surface-3 hover:bg-border-subtle'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Conversation History (Scrollable) */}
          <div className="w-full max-w-md mb-8 max-h-[30vh] overflow-y-auto">
            <AnimatePresence>
              {conversationHistory.slice(-4).map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={cn(
                    'mb-4 p-3 rounded-xl',
                    entry.role === 'user'
                      ? 'bg-neon-primary/20 ml-8'
                      : 'bg-surface-3 mr-8'
                  )}
                >
                  <p className="text-sm">{entry.content}</p>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Live WebRTC transcript preview */}
            {isWebRTC && rtcListening && rtcTranscript && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                className="mb-4 p-3 rounded-xl bg-neon-primary/10 ml-8 border border-neon-primary/20"
              >
                <p className="text-sm italic text-text-muted">{rtcTranscript}...</p>
              </motion.div>
            )}

            {/* Live WebRTC response preview */}
            {isWebRTC && rtcSpeaking && rtcResponse && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                className="mb-4 p-3 rounded-xl bg-surface-3/70 mr-8 border border-white/10"
              >
                <p className="text-sm italic text-text-muted">{rtcResponse}</p>
              </motion.div>
            )}
          </div>

          {/* Central Voice Orb */}
          <motion.button
            onClick={handleInteraction}
            className="relative"
            whileTap={{ scale: 0.95 }}
          >
            {/* Background glow */}
            <motion.div
              className={cn(
                'absolute inset-0 rounded-full blur-3xl',
                isListeningNow && 'bg-red-500/30',
                isSpeakingNow && 'bg-green-500/30',
                isWebRTC && rtcConnected && !isListeningNow && !isSpeakingNow && 'bg-emerald-500/20',
                !isActive && 'bg-neon-primary/20'
              )}
              animate={{
                scale: isListeningNow ? [1, 1.2, 1] : 1,
                opacity: isListeningNow ? [0.5, 0.8, 0.5] : 0.5,
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ width: 250, height: 250 }}
            />

            {/* Main orb */}
            <motion.div
              className={cn(
                'relative h-40 w-40 rounded-full flex items-center justify-center',
                'bg-gradient-to-br shadow-2xl',
                getOrbColors()
              )}
              animate={
                isListeningNow
                  ? { scale: [1, 1 + (isWebRTC ? 0.05 : audioLevel * 0.15), 1] }
                  : isSpeakingNow
                  ? { scale: [1, 1.05, 1] }
                  : {}
              }
              transition={{ duration: 0.3 }}
            >
              {/* Inner gradient */}
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-white/20 to-transparent" />

              {/* Icon */}
              {isProcessing ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Bot className="h-16 w-16 text-white/80" />
                </motion.div>
              ) : isSpeakingNow ? (
                <Volume2 className="h-16 w-16 text-white/80" />
              ) : isWebRTC && rtcConnected ? (
                <Zap className="h-16 w-16 text-white/80" />
              ) : (
                <Mic className="h-16 w-16 text-white/80" />
              )}
            </motion.div>

            {/* Ripple effects when listening */}
            {isListeningNow && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-red-500"
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ width: 160, height: 160, margin: 'auto' }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-red-500"
                  initial={{ scale: 1, opacity: 0.4 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                  style={{ width: 160, height: 160, margin: 'auto' }}
                />
              </>
            )}

            {/* WebRTC connected pulse */}
            {isWebRTC && rtcConnected && !isListeningNow && !isSpeakingNow && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-emerald-500/50"
                initial={{ scale: 1, opacity: 0.3 }}
                animate={{ scale: 1.3, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ width: 160, height: 160, margin: 'auto' }}
              />
            )}
          </motion.button>

          {/* Status Text */}
          <motion.p
            className="mt-8 text-lg text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {getStatusText()}
          </motion.p>

          {/* Hint */}
          <p className="mt-2 text-sm text-text-muted">
            {isWebRTC && rtcConnected
              ? 'Server VAD active — just speak naturally. ESC to close.'
              : 'Press ESC to close'}
          </p>
        </div>

        {/* Bottom Controls */}
        <footer className="p-6 flex justify-center gap-3">
          <Button
            variant="glass"
            onClick={onClose}
            className="gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Switch to Text
          </Button>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
}

VoiceConversation.displayName = 'VoiceConversation';
