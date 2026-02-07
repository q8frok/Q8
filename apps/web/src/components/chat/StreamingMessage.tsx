'use client';

import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ToolExecutionList } from './ToolExecutionChip';
import type { CitationSource } from './Citation';
import { MemoryContextBadge, type MemoryContextData } from './MemoryContextBadge';
import { GeneratedImageDisplay, type GeneratedImageData } from './GeneratedImageDisplay';
import { MessageActions } from './MessageActions';
import { MessageAvatar } from './MessageAvatar';
import { MessageBubble } from './MessageBubble';
import { SpeakingIndicator } from './SpeakingIndicator';
import { ThinkingIndicator } from './ThinkingIndicator';
import { getAgentConfig, formatTimestamp, type AgentRole } from './messageUtils';
import type { ToolExecution, Citation, MemoryContext, GeneratedImage, RunMetadata, HandoffInfo, PipelineState } from '@/hooks/useChat';

interface StreamingMessageProps {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: AgentRole;
  isStreaming?: boolean;
  toolExecutions?: ToolExecution[];
  citations?: Citation[];
  memoriesUsed?: MemoryContext[];
  images?: GeneratedImage[];
  imageAnalysis?: string;
  handoff?: HandoffInfo;
  run?: RunMetadata;
  timestamp: Date;
  className?: string;
  onAction?: (action: 'copy' | 'regenerate' | 'thumbsUp' | 'thumbsDown', messageId: string) => void;
  isSpeaking?: boolean;
  onStopSpeaking?: () => void;
  isReasoning?: boolean;
  pipelineState?: PipelineState;
  pipelineDetail?: string | null;
}

/**
 * StreamingMessage Component
 *
 * Chat message with streaming support and tool execution display.
 * Orchestrates sub-components: MessageAvatar, MessageBubble,
 * MessageActions, SpeakingIndicator, and shared chat components.
 */
export const StreamingMessage = memo(function StreamingMessage({
  id,
  role,
  content,
  agent,
  isStreaming = false,
  toolExecutions = [],
  citations = [],
  memoriesUsed = [],
  images = [],
  imageAnalysis,
  handoff,
  run,
  timestamp,
  className,
  onAction,
  isSpeaking = false,
  onStopSpeaking,
  isReasoning,
  pipelineState,
  pipelineDetail,
}: StreamingMessageProps) {
  const [showActions, setShowActions] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const isUser = role === 'user';
  const isBot = !isUser;
  const agentConfig = getAgentConfig(isUser ? 'user' : (agent || 'orchestrator'));

  const citationSources: CitationSource[] = useMemo(() =>
    citations.map((c, index) => ({
      id: c.id || `citation-${index}`,
      title: c.source,
      url: c.url,
      relevance: c.relevance,
      source: c.url ? new URL(c.url).hostname : undefined,
    })),
    [citations]
  );

  const memoryContexts: MemoryContextData[] = useMemo(() =>
    memoriesUsed.map(m => ({
      id: m.id, memoryId: m.memoryId, content: m.content, relevance: m.relevance,
    })),
    [memoriesUsed]
  );

  const imageData: GeneratedImageData[] = useMemo(() =>
    images.map(img => ({
      id: img.id, data: img.data, mimeType: img.mimeType, caption: img.caption, model: img.model,
    })),
    [images]
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    onAction?.('copy', id);
  };

  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [content, isStreaming]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-2.5 sm:gap-4 group', isUser ? 'flex-row-reverse' : 'flex-row', className)}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <MessageAvatar agentConfig={agentConfig} isStreaming={isStreaming} />

      <div className={cn('flex-1 max-w-[85vw] sm:max-w-2xl min-w-0', isUser && 'flex flex-col items-end')}>
        {isBot && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm font-medium">{agentConfig.name}</span>
            <span className="text-xs text-text-muted">{formatTimestamp(timestamp)}</span>
            {isStreaming && (
              <motion.span
                className="text-xs text-neon-primary"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                Streaming...
              </motion.span>
            )}
          </div>
        )}

        <AnimatePresence>
          {isSpeaking && !isStreaming && (
            <div className="mb-2">
              <SpeakingIndicator onStop={onStopSpeaking} />
            </div>
          )}
        </AnimatePresence>

        {memoryContexts.length > 0 && <MemoryContextBadge memories={memoryContexts} />}

        {isBot && (handoff || run) && (
          <div className="mb-2 flex flex-wrap gap-2 text-xs text-text-muted">
            {handoff && (
              <span className="rounded-full border border-border-subtle bg-muted/20 px-2 py-0.5">
                Handoff: {handoff.from} → {handoff.to}
              </span>
            )}
            {run && (
              <span className="rounded-full border border-border-subtle bg-muted/20 px-2 py-0.5">
                Run {run.state.replace('_', ' ')}
              </span>
            )}
          </div>
        )}

        {toolExecutions.length > 0 && (
          <ToolExecutionList
            tools={toolExecutions.map(t => ({
              id: t.id, tool: t.tool, status: t.status, args: t.args, result: t.result,
            }))}
          />
        )}

        {imageData.length > 0 && <GeneratedImageDisplay images={imageData} />}

        <AnimatePresence>
          {isBot && isStreaming && pipelineState && pipelineState !== 'done' && (
            <div className="mb-1">
              <ThinkingIndicator
                pipelineState={pipelineState}
                pipelineDetail={pipelineDetail}
                isReasoning={isReasoning}
              />
            </div>
          )}
        </AnimatePresence>

        <MessageBubble
          ref={contentRef}
          content={content}
          isUser={isUser}
          isStreaming={isStreaming}
          imageAnalysis={imageAnalysis}
          citationSources={citationSources}
          agentGlowClass={isBot ? agentConfig.glowColor : undefined}
        />

        {isBot && !isStreaming && content && (
          <MessageActions
            messageId={id}
            visible={showActions}
            onCopy={handleCopy}
            isCopied={isCopied}
            onRegenerate={() => onAction?.('regenerate', id)}
            onThumbsUp={() => onAction?.('thumbsUp', id)}
            onThumbsDown={() => onAction?.('thumbsDown', id)}
          />
        )}

        {isUser && (
          <span className="text-xs text-text-muted mt-1">{formatTimestamp(timestamp)}</span>
        )}
      </div>
    </motion.div>
  );
});

StreamingMessage.displayName = 'StreamingMessage';
