'use client';

import { Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { useSendToChat } from '@/contexts/ChatContext';

interface AIButtonProps {
  /**
   * Context data to include with the message
   */
  context?: Record<string, unknown>;
  /**
   * Prompt/message to send to the AI agent
   */
  prompt?: string;
  /**
   * Additional click handler
   */
  onClick?: () => void;
}

/**
 * AIButton Component
 *
 * A sparkle button that sends a message with context to the chat agent.
 * Can be placed anywhere in the component tree to trigger AI interactions.
 *
 * @example
 * ```tsx
 * <AIButton
 *   prompt="Summarize this PR"
 *   context={{ repo: "q8-app", pr: 42 }}
 * />
 * ```
 */
export function AIButton({ context, prompt, onClick }: AIButtonProps) {
  const sendToChat = useSendToChat();

  const handleClick = () => {
    // Call custom onClick handler if provided
    if (onClick) {
      onClick();
    }

    // Send message to agent with context when prompt is provided
    if (prompt) {
      sendToChat(prompt, context);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className="relative group"
      aria-label="AI Assistant"
      title={prompt || 'Ask AI'}
    >
      <Sparkles className="h-4 w-4 text-neon-primary animate-pulse-slow group-hover:text-neon-accent transition-colors" />
    </Button>
  );
}
