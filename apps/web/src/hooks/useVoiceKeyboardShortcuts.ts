import { useEffect } from 'react';
import type { ConversationMode } from '@/hooks/useUnifiedChat';

interface UseVoiceKeyboardShortcutsOptions {
  mode: ConversationMode;
  isRecording: boolean;
  onVoiceInteraction: () => void;
  onCancelRecording: () => void;
}

/**
 * Keyboard shortcuts for voice mode:
 * - Space: toggle recording (when not focused on a textarea)
 * - Escape: cancel recording
 */
export function useVoiceKeyboardShortcuts({
  mode,
  isRecording,
  onVoiceInteraction,
  onCancelRecording,
}: UseVoiceKeyboardShortcutsOptions) {
  useEffect(() => {
    if (mode === 'text') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        onVoiceInteraction();
      }
      if (e.key === 'Escape' && isRecording) {
        onCancelRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, isRecording, onVoiceInteraction, onCancelRecording]);
}
