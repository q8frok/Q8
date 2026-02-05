'use client';

import { useRef, forwardRef, useImperativeHandle } from 'react';
import { Loader2 } from 'lucide-react';
import { ChatInput, type ChatInputRef } from './ChatInput';
import { VoiceInputArea } from './VoiceInputArea';
import type { ConversationMode } from '@/hooks/useUnifiedChat';

interface ConversationInputAreaProps {
  mode: ConversationMode;
  isLoading: boolean;
  isStreaming: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  isSpeaking: boolean;
  currentThreadId: string | null;
  onSend: (content: string) => void;
  onCancelStream: () => void;
  onVoiceInteraction: () => void;
  onSwitchMode: (mode: ConversationMode) => void;
}

export interface ConversationInputAreaRef {
  insertMention: (mention: string) => void;
}

export const ConversationInputArea = forwardRef<ConversationInputAreaRef, ConversationInputAreaProps>(
  function ConversationInputArea(
    {
      mode,
      isLoading,
      isStreaming,
      isRecording,
      isTranscribing,
      isSpeaking,
      currentThreadId,
      onSend,
      onCancelStream,
      onVoiceInteraction,
      onSwitchMode,
    },
    ref
  ) {
    const chatInputRef = useRef<ChatInputRef>(null);

    useImperativeHandle(ref, () => ({
      insertMention: (mention: string) => {
        chatInputRef.current?.insertMention(mention);
      },
    }));

    return (
      <div className="p-3 border-t border-border-subtle">
        {/* Cancel streaming button */}
        {isStreaming && (
          <div className="flex items-center justify-center mb-2">
            <button
              onClick={onCancelStream}
              className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors focus-ring rounded"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              Stop
            </button>
          </div>
        )}

        {/* Adaptive Input */}
        {mode === 'text' ? (
          <ChatInput
            ref={chatInputRef}
            onSend={onSend}
            disabled={isLoading}
            placeholder={isStreaming ? 'Waiting...' : 'Message Q8...'}
            showFileUpload={true}
            showVoice={true}
            onVoiceToggle={() => onSwitchMode('voice')}
            threadId={currentThreadId || undefined}
          />
        ) : (
          <VoiceInputArea
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            isSpeaking={isSpeaking}
            isLoading={isLoading}
            onVoiceInteraction={onVoiceInteraction}
            onSwitchToText={() => onSwitchMode('text')}
          />
        )}
      </div>
    );
  }
);

ConversationInputArea.displayName = 'ConversationInputArea';
