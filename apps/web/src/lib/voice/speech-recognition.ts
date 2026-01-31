/**
 * Voice Recognition Utility
 * Web Speech API wrapper for voice input
 */

export interface VoiceRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  language?: string;
  maxAlternatives?: number;
}

export interface VoiceRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export type VoiceRecognitionCallback = (result: VoiceRecognitionResult) => void;
export type VoiceErrorCallback = (error: string) => void;

export class VoiceRecognition {
  private recognition: any = null;
  private isListening = false;

  constructor(private options: VoiceRecognitionOptions = {}) {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.continuous = options.continuous ?? false;
    this.recognition.interimResults = options.interimResults ?? true;
    this.recognition.lang = options.language ?? 'en-US';
    this.recognition.maxAlternatives = options.maxAlternatives ?? 1;
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }

  start(
    onResult: VoiceRecognitionCallback,
    onError?: VoiceErrorCallback
  ): boolean {
    if (!this.recognition || this.isListening) return false;

    this.recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;

      onResult({
        transcript,
        confidence,
        isFinal: result.isFinal,
      });
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      onError?.(event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };

    try {
      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      onError?.('Failed to start recognition');
      return false;
    }
  }

  stop(): void {
    if (!this.recognition || !this.isListening) return;

    try {
      this.recognition.stop();
      this.isListening = false;
    } catch (error) {
      console.error('Failed to stop speech recognition:', error);
    }
  }

  abort(): void {
    if (!this.recognition) return;

    try {
      this.recognition.abort();
      this.isListening = false;
    } catch (error) {
      console.error('Failed to abort speech recognition:', error);
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }
}

export function createVoiceRecognition(options?: VoiceRecognitionOptions): VoiceRecognition {
  return new VoiceRecognition(options);
}
