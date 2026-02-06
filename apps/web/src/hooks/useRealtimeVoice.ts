'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '@/lib/logger';

export type RealtimeVoiceState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'speaking'
  | 'listening'
  | 'fallback'
  | 'error';

interface RealtimeVoiceConfig {
  voice?: string;
  instructions?: string;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onResponse?: (text: string) => void;
  onError?: (error: string) => void;
  onFallback?: (reason: string) => void;
  onStateChange?: (state: RealtimeVoiceState) => void;
}

interface UseRealtimeVoiceReturn {
  state: RealtimeVoiceState;
  isConnected: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  interrupt: () => void;
  lastTranscript: string;
  lastResponse: string;
  latencyMs: number | null;
  error: string | null;
  isFallback: boolean;
}

const MAX_RECONNECT_ATTEMPTS = 4;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 10_000;

export function useRealtimeVoice(config: RealtimeVoiceConfig = {}): UseRealtimeVoiceReturn {
  const {
    voice = 'nova',
    instructions,
    onTranscript,
    onResponse,
    onError,
    onFallback,
    onStateChange,
  } = config;

  const [state, setState] = useState<RealtimeVoiceState>('idle');
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const manualDisconnectRef = useRef(false);
  const stateRef = useRef<RealtimeVoiceState>('idle');
  const connectRef = useRef<(() => Promise<void>) | null>(null);

  const updateState = useCallback(
    (newState: RealtimeVoiceState) => {
      stateRef.current = newState;
      setState(newState);
      onStateChange?.(newState);
    },
    [onStateChange]
  );

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const classifyTerminalError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    const lowerMsg = message.toLowerCase();
    const isTerminal =
      lowerMsg.includes('permission denied') ||
      lowerMsg.includes('notallowederror') ||
      lowerMsg.includes('not found') ||
      lowerMsg.includes('no client secret') ||
      lowerMsg.includes('invalid token') ||
      lowerMsg.includes('unauthorized') ||
      lowerMsg.includes('forbidden') ||
      lowerMsg.includes('unsupported') ||
      lowerMsg.includes('not implemented') ||
      lowerMsg.includes('not available');

    return { message, isTerminal };
  }, []);

  const enterFallbackMode = useCallback((reason: string) => {
    clearReconnectTimer();
    updateState('fallback');
    onFallback?.(reason);
    logger.warn('Realtime voice unavailable, downgrading to non-realtime mode', {
      reason,
    });
  }, [clearReconnectTimer, onFallback, updateState]);

  const cleanup = useCallback(() => {
    clearReconnectTimer();

    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => {
        sender.track?.stop();
      });
      pcRef.current.close();
      pcRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
  }, [clearReconnectTimer]);

  const scheduleReconnect = useCallback(
    (reason: string) => {
      const hasAttemptsRemaining = reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS;
      if (!hasAttemptsRemaining) {
        enterFallbackMode(reason);
        return;
      }

      const nextAttempt = reconnectAttemptsRef.current + 1;
      reconnectAttemptsRef.current = nextAttempt;
      const delay = Math.min(
        INITIAL_RECONNECT_DELAY_MS * Math.pow(2, nextAttempt - 1),
        MAX_RECONNECT_DELAY_MS
      );

      updateState('connecting');
      logger.warn('Scheduling realtime voice reconnect', {
        nextAttempt,
        delayMs: delay,
        reason,
      });

      clearReconnectTimer();
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connectRef.current?.().catch((reconnectErr) => {
          logger.error('Realtime reconnect attempt failed', {
            errorMessage: reconnectErr instanceof Error ? reconnectErr.message : String(reconnectErr),
          });
        });
      }, delay);
    },
    [clearReconnectTimer, enterFallbackMode, updateState]
  );

  const handleConnectionFailure = useCallback((reason: string, isTerminal = false) => {
    if (manualDisconnectRef.current) return;

    setError(reason);
    onError?.(reason);

    cleanup();
    if (isTerminal) {
      enterFallbackMode(reason);
      return;
    }

    scheduleReconnect(reason);
  }, [cleanup, enterFallbackMode, onError, scheduleReconnect]);

  const handleRealtimeEvent = useCallback(
    (event: Record<string, unknown>) => {
      const type = event.type as string;

      switch (type) {
        case 'input_audio_buffer.speech_started':
          updateState('listening');
          speechStartRef.current = Date.now();
          break;

        case 'input_audio_buffer.speech_stopped':
          updateState('connected');
          break;

        case 'response.audio.started':
          updateState('speaking');
          break;

        case 'response.audio.done':
          updateState('connected');
          break;

        case 'conversation.item.input_audio_transcription.completed': {
          const transcript = (event.transcript as string) || '';
          setLastTranscript(transcript);
          onTranscript?.(transcript, true);
          break;
        }

        case 'response.audio_transcript.delta': {
          const delta = (event.delta as string) || '';
          setLastResponse((prev) => prev + delta);
          break;
        }

        case 'response.audio_transcript.done': {
          const transcript = (event.transcript as string) || '';
          setLastResponse(transcript);
          onResponse?.(transcript);
          break;
        }

        case 'error': {
          const errMsg =
            ((event.error as Record<string, unknown>)?.message as string) || 'Realtime API error';
          setError(errMsg);
          onError?.(errMsg);
          break;
        }
      }
    },
    [onError, onResponse, onTranscript, updateState]
  );

  const connect = useCallback(async () => {
    if (typeof window !== 'undefined' && !('RTCPeerConnection' in window)) {
      const reason = 'Realtime voice is not supported in this browser';
      setError(reason);
      enterFallbackMode(reason);
      return;
    }

    manualDisconnectRef.current = false;
    clearReconnectTimer();
    cleanup();

    updateState('connecting');
    setError(null);

    try {
      const tokenRes = await fetch('/api/voice/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice, instructions }),
      });

      if (!tokenRes.ok) {
        const data = await tokenRes.json().catch(() => ({}));
        throw new Error(data?.error?.message || 'Failed to get voice session token');
      }

      const tokenData = await tokenRes.json();
      const { clientSecret } = tokenData;
      if (!clientSecret) {
        throw new Error('No client secret received');
      }

      const iceServers = Array.isArray(tokenData.iceServers) ? tokenData.iceServers : undefined;

      logger.info('Initializing realtime voice peer connection', {
        hasIcePolicy: Boolean(iceServers?.length),
        iceServerCount: iceServers?.length ?? 0,
      });

      const pc = new RTCPeerConnection(
        iceServers?.length
          ? {
              iceServers,
            }
          : undefined
      );
      pcRef.current = pc;

      const logConnectionDiagnostics = (source: string) => {
        logger.info('Realtime voice connection diagnostics', {
          source,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          iceGatheringState: pc.iceGatheringState,
          signalingState: pc.signalingState,
          reconnectAttempts: reconnectAttemptsRef.current,
        });
      };

      pc.addEventListener('connectionstatechange', () => {
        logConnectionDiagnostics('connectionstatechange');

        if (pc.connectionState === 'connected') {
          reconnectAttemptsRef.current = 0;
          updateState('connected');
          return;
        }

        if (pc.connectionState === 'disconnected') {
          if (!manualDisconnectRef.current && stateRef.current !== 'fallback') {
            updateState('connecting');
          }
          return;
        }

        if (pc.connectionState === 'failed' && !manualDisconnectRef.current) {
          handleConnectionFailure('Peer connection failed during realtime session');
        }
      });

      pc.addEventListener('iceconnectionstatechange', () => {
        logConnectionDiagnostics('iceconnectionstatechange');

        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          updateState('connected');
          return;
        }

        if (pc.iceConnectionState === 'checking') {
          updateState('connecting');
          return;
        }

        if (pc.iceConnectionState === 'failed' && !manualDisconnectRef.current) {
          handleConnectionFailure('ICE connectivity failed for realtime voice');
        }
      });

      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioRef.current = audioEl;

      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0] ?? null;
        if (speechStartRef.current) {
          const latency = Date.now() - speechStartRef.current;
          setLatencyMs(latency);
          speechStartRef.current = null;
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        reconnectAttemptsRef.current = 0;
        updateState('connected');
        logger.info('Realtime voice data channel opened');
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleRealtimeEvent(msg);
        } catch {
          // Ignore unparseable messages
        }
      };

      dc.onclose = () => {
        logger.info('Realtime voice data channel closed');
        if (!manualDisconnectRef.current && stateRef.current !== 'fallback') {
          handleConnectionFailure('Realtime data channel closed unexpectedly');
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${clientSecret}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        }
      );

      if (!sdpResponse.ok) {
        throw new Error(`SDP exchange failed: ${sdpResponse.status}`);
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      logger.info('WebRTC connection established');
    } catch (err) {
      const { message, isTerminal } = classifyTerminalError(err);
      logger.error('Realtime voice connection failed', {
        errorMessage: message,
        isTerminal,
        reconnectAttempts: reconnectAttemptsRef.current,
      });
      handleConnectionFailure(message, isTerminal);
    }
  }, [
    cleanup,
    clearReconnectTimer,
    classifyTerminalError,
    enterFallbackMode,
    handleConnectionFailure,
    instructions,
    updateState,
    voice,
    handleRealtimeEvent,
  ]);

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    cleanup();
    reconnectAttemptsRef.current = 0;
    updateState('idle');
    setLastTranscript('');
    setLastResponse('');
  }, [cleanup, updateState]);

  const interrupt = useCallback(() => {
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify({ type: 'response.cancel' }));
      updateState('connected');
    }
  }, [updateState]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    isConnected: state === 'connected' || state === 'speaking' || state === 'listening',
    isSpeaking: state === 'speaking',
    isListening: state === 'listening',
    connect,
    disconnect,
    interrupt,
    lastTranscript,
    lastResponse,
    latencyMs,
    error,
    isFallback: state === 'fallback',
  };
}
