/**
 * Voice Synthesis Utility
 * Web Speech API wrapper for text-to-speech
 */

import { logger } from '@/lib/logger';

export interface VoiceSynthesisOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

export class VoiceSynthesis {
  private synthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.synthesis = window.speechSynthesis;
    }
  }

  isSupported(): boolean {
    return this.synthesis !== null;
  }

  getVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) return [];
    return this.synthesis.getVoices();
  }

  speak(
    text: string,
    options: VoiceSynthesisOptions = {},
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (error: SpeechSynthesisErrorEvent) => void;
    }
  ): boolean {
    if (!this.synthesis) return false;

    this.cancel();

    this.currentUtterance = new SpeechSynthesisUtterance(text);
    
    if (options.voice) this.currentUtterance.voice = options.voice;
    if (options.rate) this.currentUtterance.rate = options.rate;
    if (options.pitch) this.currentUtterance.pitch = options.pitch;
    if (options.volume) this.currentUtterance.volume = options.volume;
    if (options.lang) this.currentUtterance.lang = options.lang;

    if (callbacks?.onStart) {
      this.currentUtterance.onstart = callbacks.onStart;
    }
    if (callbacks?.onEnd) {
      this.currentUtterance.onend = callbacks.onEnd;
    }
    if (callbacks?.onError) {
      this.currentUtterance.onerror = callbacks.onError;
    }

    try {
      this.synthesis.speak(this.currentUtterance);
      return true;
    } catch (error) {
      logger.error('Failed to speak', { error });
      return false;
    }
  }

  pause(): void {
    if (!this.synthesis) return;
    this.synthesis.pause();
  }

  resume(): void {
    if (!this.synthesis) return;
    this.synthesis.resume();
  }

  cancel(): void {
    if (!this.synthesis) return;
    this.synthesis.cancel();
    this.currentUtterance = null;
  }

  isSpeaking(): boolean {
    if (!this.synthesis) return false;
    return this.synthesis.speaking;
  }

  isPaused(): boolean {
    if (!this.synthesis) return false;
    return this.synthesis.paused;
  }
}

export function createVoiceSynthesis(): VoiceSynthesis {
  return new VoiceSynthesis();
}
