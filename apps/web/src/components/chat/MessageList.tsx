'use client';

import { useRef, useEffect, useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StreamingMessage } from './StreamingMessage';
import { AgentHandoff } from './AgentHandoff';
import { ChatEmptyState } from './ChatEmptyState';
import type { AgentType, StreamingMessage as StreamingMessageType, RunState, PipelineState } from '@/hooks/useChat';

interface MessageListProps {
  messages: StreamingMessageType[];
  isLoading: boolean;
  isStreaming: boolean;
  activeAgent: string | null;
  routingReason: string | null;
  error: string | null;
  runState: RunState | null;
  pipelineState?: PipelineState;
  pipelineDetail?: string | null;
  onSend: (content: string) => void;
  onMentionInsert: (mention: string) => void;
  onRetry: () => void;
  onMessageAction: (action: string) => void;
}

export const MessageList = memo(function MessageList({
  messages,
  isLoading,
  isStreaming,
  activeAgent,
  routingReason,
  error,
  runState,
  pipelineState,
  pipelineDetail,
  onSend,
  onMentionInsert,
  onRetry,
  onMessageAction,
}: MessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // Detect if user has scrolled away from bottom (debounced via rAF)
  const scrollRafRef = useRef<number | null>(null);
  const handleScroll = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = scrollContainerRef.current;
      if (!el) return;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setUserScrolledUp(distanceFromBottom > 150);
    });
  }, []);

  // Auto-scroll when near bottom or new messages arrive
  useEffect(() => {
    if (!userScrolledUp && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming, userScrolledUp]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUserScrolledUp(false);
  }, []);

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3 relative"
    >
      {/* Empty State */}
      {messages.length === 0 && !isLoading && (
        <ChatEmptyState onSend={onSend} onMentionInsert={onMentionInsert} />
      )}

      {/* Agent Handoff Animation */}
      <AnimatePresence>
        {isLoading && activeAgent && routingReason && !isStreaming && (
          <AgentHandoff to={activeAgent as AgentType} reason={routingReason} />
        )}
      </AnimatePresence>

      {runState && (
        <div className="text-center text-xs text-text-muted">Run status: {runState.replace('_', ' ')}</div>
      )}

      {/* Messages */}
      {messages.map((message) => (
        <div key={message.id} className="chat-message-item">
        <StreamingMessage
          id={message.id}
          role={message.role}
          content={message.content}
          agent={message.agent as AgentType}
          isStreaming={message.isStreaming}
          toolExecutions={message.toolExecutions}
          handoff={message.handoff}
          run={message.run}
          timestamp={message.timestamp}
          onAction={onMessageAction}
          isReasoning={message.isReasoning}
          pipelineState={message.isStreaming ? pipelineState : undefined}
          pipelineDetail={message.isStreaming ? pipelineDetail : undefined}
        />
        </div>
      ))}

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger"
        >
          <span className="text-sm">{error}</span>
          <Button variant="ghost" size="sm" onClick={onRetry} className="text-xs">
            Retry
          </Button>
        </motion.div>
      )}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />

      {/* Scroll-to-bottom button */}
      <AnimatePresence>
        {userScrolledUp && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={scrollToBottom}
            className="sticky bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-elevated border border-border-subtle shadow-lg backdrop-blur-md text-xs text-text-secondary hover:text-text-primary active:scale-95 transition-all"
          >
            <ArrowDown className="h-3 w-3" />
            New content below
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
});

MessageList.displayName = 'MessageList';
