'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Volume2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StepProps } from '../OnboardingWizard';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export function VoiceSetupStep({ onNext: _onNext }: StepProps) {
  const [micStatus, setMicStatus] = useState<TestStatus>('idle');
  const [speakerStatus, setSpeakerStatus] = useState<TestStatus>('idle');
  const [micError, setMicError] = useState<string | null>(null);

  const testMicrophone = async () => {
    setMicStatus('testing');
    setMicError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Got permission and working
      stream.getTracks().forEach(track => track.stop());
      setMicStatus('success');
    } catch (err) {
      setMicStatus('error');
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setMicError('Microphone access denied. Please allow access in your browser settings.');
        } else if (err.name === 'NotFoundError') {
          setMicError('No microphone found. Please connect a microphone.');
        } else {
          setMicError(err.message);
        }
      }
    }
  };

  const testSpeakers = async () => {
    setSpeakerStatus('testing');

    try {
      // Create a short beep sound
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 440; // A4 note
      gainNode.gain.value = 0.1;

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
        setSpeakerStatus('success');
      }, 200);
    } catch {
      setSpeakerStatus('error');
    }
  };

  const allTestsPassed = micStatus === 'success' && speakerStatus === 'success';

  return (
    <div className="max-w-lg mx-auto">
      <p className="text-text-muted mb-6">
        Test your microphone and speakers to ensure voice interactions work smoothly.
      </p>

      <div className="grid gap-4 mb-6">
        {/* Microphone Test */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-xl bg-surface-2 border border-border-subtle"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-neon-primary/20 flex items-center justify-center">
                <Mic className="h-6 w-6 text-neon-primary" />
              </div>
              <div>
                <h3 className="font-medium">Microphone</h3>
                <p className="text-sm text-text-muted">Test voice input</p>
              </div>
            </div>
            {micStatus === 'success' && <Check className="h-6 w-6 text-green-500" />}
            {micStatus === 'error' && <AlertCircle className="h-6 w-6 text-red-500" />}
          </div>
          {micError && (
            <p className="text-sm text-red-400 mb-3">{micError}</p>
          )}
          <Button
            onClick={testMicrophone}
            disabled={micStatus === 'testing'}
            variant={micStatus === 'success' ? 'subtle' : 'default'}
            className="w-full"
          >
            {micStatus === 'testing' && 'Testing...'}
            {micStatus === 'idle' && 'Test Microphone'}
            {micStatus === 'success' && 'Microphone Working'}
            {micStatus === 'error' && 'Try Again'}
          </Button>
        </motion.div>

        {/* Speaker Test */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 rounded-xl bg-surface-2 border border-border-subtle"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-neon-primary/20 flex items-center justify-center">
                <Volume2 className="h-6 w-6 text-neon-primary" />
              </div>
              <div>
                <h3 className="font-medium">Speakers</h3>
                <p className="text-sm text-text-muted">Test audio output</p>
              </div>
            </div>
            {speakerStatus === 'success' && <Check className="h-6 w-6 text-green-500" />}
            {speakerStatus === 'error' && <AlertCircle className="h-6 w-6 text-red-500" />}
          </div>
          <Button
            onClick={testSpeakers}
            disabled={speakerStatus === 'testing'}
            variant={speakerStatus === 'success' ? 'subtle' : 'default'}
            className="w-full"
          >
            {speakerStatus === 'testing' && 'Playing...'}
            {speakerStatus === 'idle' && 'Test Speakers'}
            {speakerStatus === 'success' && 'Speakers Working'}
            {speakerStatus === 'error' && 'Try Again'}
          </Button>
        </motion.div>
      </div>

      {allTestsPassed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-center"
        >
          <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="text-green-400 font-medium">Voice setup complete!</p>
          <p className="text-sm text-text-muted">You&apos;re ready for voice interactions.</p>
        </motion.div>
      )}
    </div>
  );
}
