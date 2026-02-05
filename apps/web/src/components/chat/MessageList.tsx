'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { StreamingMessage } from './StreamingMessage';
import { AgentHandoff } from './AgentHandoff';
import { ChatEmptyState } from './ChatEmptyState';
import type { AgentType, StreamingMessage as StreamingMessageType } from '@/hooks/useChat';

interface MessageListProps {
  messages: StreamingMessageType[];
  isLoading: boolean;
  isStreaming: boolean;
  activeAgent: string | null;
  routingReason: string | null;
  error: string | null;
  onSend: (content: string) => void;
  onMentionInsert: (mention: string) => void;
  onRetry: () => void;
  onMessageAction: (action: string) => void;
}

export function MessageList({
  messages,
  isLoading,
  isStreaming,
  activeAgent,
  routingReason,
  error,
  onSend,
  onMentionInsert,
  onRetry,
  onMessageAction,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
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

      {/* Messages */}
      {messages.map((message) => (
        <StreamingMessage
          key={message.id}
          id={message.id}
          role={message.role}
          content={message.content}
          agent={message.agent as AgentType}
          isStreaming={message.isStreaming}
          toolExecutions={message.toolExecutions}
          timestamp={message.timestamp}
          onAction={onMessageAction}
        />
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
    </div>
  );
}
