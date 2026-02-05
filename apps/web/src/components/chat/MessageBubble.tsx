'use client';

import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CitationList, type CitationSource } from './Citation';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageBubbleProps {
  content: string;
  isUser: boolean;
  isStreaming: boolean;
  imageAnalysis?: string;
  citationSources: CitationSource[];
}

/**
 * Streaming cursor component
 */
function StreamingCursor() {
  return (
    <motion.span
      className="inline-block w-2 h-5 bg-neon-primary ml-0.5"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.8, repeat: Infinity }}
    />
  );
}

/**
 * MessageBubble - renders the message content bubble with markdown,
 * streaming cursor, image analysis, and citations.
 */
export const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProps>(
  function MessageBubble({ content, isUser, isStreaming, imageAnalysis, citationSources }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl px-4 py-3 relative',
          isUser
            ? 'surface-matte bg-neon-primary/10 border border-neon-primary/20'
            : 'surface-matte'
        )}
      >
        <div
          className={cn(
            'prose prose-sm max-w-none',
            isUser && 'text-right',
            'prose-p:text-text-primary prose-headings:text-text-primary',
            'prose-code:text-neon-accent prose-code:bg-surface-3',
            'prose-pre:surface-matte prose-pre:p-0'
          )}
        >
          {content ? (
            <MarkdownRenderer content={content} />
          ) : isStreaming ? (
            <span className="text-text-muted">Thinking...</span>
          ) : null}

          {isStreaming && content && <StreamingCursor />}
        </div>

        {/* Image Analysis Block */}
        {imageAnalysis && (
          <div className="mt-3 p-3 rounded-lg bg-surface-2/60 border border-border-subtle">
            <p className="text-xs text-text-muted mb-1 font-medium">Image Analysis</p>
            <p className="text-sm text-text-secondary">{imageAnalysis}</p>
          </div>
        )}

        {/* Citations List */}
        {citationSources.length > 0 && !isStreaming && (
          <CitationList
            sources={citationSources}
            title="Sources"
            collapsed={true}
          />
        )}
      </div>
    );
  }
);

MessageBubble.displayName = 'MessageBubble';
