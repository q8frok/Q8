'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { CitationList, type CitationSource } from './Citation';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageBubbleProps {
  content: string;
  isUser: boolean;
  isStreaming: boolean;
  imageAnalysis?: string;
  citationSources: CitationSource[];
  agentGlowClass?: string;
}

/**
 * Streaming cursor component
 */
function StreamingCursor() {
  return (
    <span
      className="inline-block w-[3px] h-[18px] bg-neon-primary ml-0.5 align-text-bottom animate-cursor-blink will-change-[opacity]"
    />
  );
}

/**
 * MessageBubble - renders the message content bubble with markdown,
 * streaming cursor, image analysis, and citations.
 */
export const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProps>(
  function MessageBubble({ content, isUser, isStreaming, imageAnalysis, citationSources, agentGlowClass }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'px-4 py-3 relative',
          isUser
            ? 'rounded-2xl rounded-tr-md bg-gradient-to-br from-neon-primary/12 to-neon-primary/6 border border-neon-primary/20'
            : cn('rounded-2xl rounded-tl-md surface-matte', agentGlowClass)
        )}
      >
        <div
          className={cn(
            'prose prose-sm sm:prose-base max-w-none',
            isUser && 'text-right',
            'prose-p:text-text-primary prose-p:leading-relaxed prose-headings:text-text-primary',
            'prose-code:text-neon-accent prose-code:bg-surface-3 prose-code:text-[13px]',
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
