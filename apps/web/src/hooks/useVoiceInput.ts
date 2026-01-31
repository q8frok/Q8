'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createVoiceRecognition } from '@/lib/voice/speech-recognition';
import type { VoiceRecognitionOptions, VoiceRecognitionResult } from '@/lib/voice/speech-recognition';

export function useVoiceInput(options?: VoiceRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef(createVoiceRecognition(options));

  useEffect(() => {
    setIsSupported(recognitionRef.current.isSupported());
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current.isSupported()) {
      setError('Voice recognition not supported');
      return false;
    }

    setError(null);
    setTranscript('');
    setInterimTranscript('');

    const success = recognitionRef.current.start(
      (result: VoiceRecognitionResult) => {
        if (result.isFinal) {
          setTranscript((prev) => prev + result.transcript + ' ');
          setInterimTranscript('');
        } else {
          setInterimTranscript(result.transcript);
        }
      },
      (err: string) => {
        setError(err);
        setIsListening(false);
      }
    );

    if (success) {
      setIsListening(true);
    }

    return success;
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current.stop();
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
