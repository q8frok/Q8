'use client';

import { useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useUnifiedChat, type ConversationMode } from '@/hooks/useUnifiedChat';
import { useVoiceKeyboardShortcuts } from '@/hooks/useVoiceKeyboardShortcuts';
import { AudioLevelIndicator } from '@/components/voice/AudioLevelIndicator';
import { ConversationHeader } from './ConversationHeader';
import { MessageList } from './MessageList';
import { ConversationInputArea, type ConversationInputAreaRef } from './ConversationInputArea';
import { logger } from '@/lib/logger';

export interface UnifiedConversationRef {
  sendMessage: (message: string) => void;
  switchMode: (mode: ConversationMode) => void;
}

interface UnifiedConversationProps {
  userId: string;
  threadId?: string | null;
  userProfile?: {
    name?: string;
    timezone?: string;
    communicationStyle?: 'concise' | 'detailed';
  };
  defaultMode?: ConversationMode;
  onThreadCreated?: (threadId: string) => void;
  showSidebarToggle?: boolean;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  className?: string;
}

export const UnifiedConversation = forwardRef<UnifiedConversationRef, UnifiedConversationProps>(
  function UnifiedConversation(
    {
      userId,
      threadId,
      userProfile,
      defaultMode = 'text',
      onThreadCreated,
      showSidebarToggle = false,
      sidebarOpen = false,
      onToggleSidebar,
      className,
    },
    ref
  ) {
    const inputAreaRef = useRef<ConversationInputAreaRef>(null);

    const {
      messages,
      isLoading,
      isStreaming,
      routingReason,
      error,
      threadId: currentThreadId,
      runState,
      mode,
      isRecording,
      isTranscribing,
      isSpeaking,
      audioLevel,
      activeAgent,
      agentStack,
      ttsEnabled,
      send,
      switchMode,
      startRecording,
      stopRecording,
      cancelRecording,
      stopSpeaking,
      toggleTTS,
      cancelStream,
      clearMessages,
      retryLast,
    } = useUnifiedChat({
      userId,
      threadId,
      userProfile,
      defaultMode,
      autoSpeak: true,
      onRouting: (agent, reason) => logger.info('Routing to agent', { agent, reason }),
      onAgentHandoff: (from, to, reason) => logger.info('Agent hand-off', { from, to, reason }),
      onModeSwitch: (from, to) => logger.info('Mode switched', { from, to }),
      onThreadCreated: (newThreadId) => {
        logger.info('Thread created', { threadId: newThreadId });
        onThreadCreated?.(newThreadId);
      },
      onError: (err) => logger.error('Unified chat error', { error: err }),
    });
    useImperativeHandle(
      ref,
      () => ({
        sendMessage: (message: string) => {
          if (message.trim()) {
            send(message, 'keyboard');
          }
        },
        switchMode,
      }),
      [send, switchMode]
    );
    const handleVoiceInteraction = useCallback(async () => {
      if (isSpeaking) {
        stopSpeaking();
        return;
      }
      if (isRecording) {
        await stopRecording();
      } else {
        await startRecording();
      }
    }, [isRecording, isSpeaking, startRecording, stopRecording, stopSpeaking]);
    useVoiceKeyboardShortcuts({
      mode,
      isRecording,
      onVoiceInteraction: handleVoiceInteraction,
      onCancelRecording: cancelRecording,
    });
    const handleSend = useCallback(
      (content: string) => {
        if (content.trim()) {
          send(content, 'keyboard');
        }
      },
      [send]
    );
    const handleMentionInsert = useCallback((mention: string) => {
      inputAreaRef.current?.insertMention(mention);
    }, []);
    const handleMessageAction = useCallback(
      (action: string) => {
        if (action === 'regenerate') {
          retryLast();
        }
      },
      [retryLast]
    );
    return (
      <div className={cn('flex flex-col h-full', className)}>
        <ConversationHeader
          mode={mode}
          activeAgent={activeAgent}
          agentStack={agentStack}
          isStreaming={isStreaming}
          ttsEnabled={ttsEnabled}
          messagesCount={messages.length}
          showSidebarToggle={showSidebarToggle}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={onToggleSidebar}
          onSwitchMode={switchMode}
          onToggleTTS={toggleTTS}
          onClearMessages={clearMessages}
        />

        <AnimatePresence>
          {(mode === 'voice' || mode === 'ambient') && (isRecording || isSpeaking) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 48, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-border-subtle overflow-hidden"
            >
              <AudioLevelIndicator audioLevel={audioLevel} isRecording={isRecording} isSpeaking={isSpeaking} />
            </motion.div>
          )}
        </AnimatePresence>
        <MessageList
          messages={messages}
          isLoading={isLoading}
          isStreaming={isStreaming}
          activeAgent={activeAgent}
          routingReason={routingReason}
          error={error}
          runState={runState}
          onSend={handleSend}
          onMentionInsert={handleMentionInsert}
          onRetry={retryLast}
          onMessageAction={handleMessageAction}
        />
        <ConversationInputArea
          ref={inputAreaRef}
          mode={mode}
          isLoading={isLoading}
          isStreaming={isStreaming}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          isSpeaking={isSpeaking}
          currentThreadId={currentThreadId}
          onSend={handleSend}
          onCancelStream={cancelStream}
          onVoiceInteraction={handleVoiceInteraction}
          onSwitchMode={switchMode}
        />
      </div>
    );
  }
);

UnifiedConversation.displayName = 'UnifiedConversation';
