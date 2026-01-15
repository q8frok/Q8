'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, ChevronDown, ChevronUp, Quote, Link2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Citation source interface
 */
export interface CitationSource {
  id: string;
  title: string;
  url?: string;
  snippet?: string;
  source?: string;
  relevance?: number;
  publishedAt?: string;
}

interface InlineCitationProps {
  number: number;
  source: CitationSource;
  className?: string;
}

/**
 * InlineCitation - Clickable citation marker that shows source on hover
 */
export function InlineCitation({ number, source, className }: InlineCitationProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        className={cn(
          'inline-flex items-center justify-center',
          'w-4 h-4 text-[10px] font-medium rounded',
          'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30',
          'transition-colors cursor-pointer',
          'align-super mx-0.5',
          className
        )}
        onClick={() => source.url && window.open(source.url, '_blank')}
        aria-label={`Citation ${number}: ${source.title}`}
      >
        {number}
      </button>

      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 left-0 top-full mt-1',
              'w-72 p-3 rounded-lg',
              'bg-surface-3 border border-border-subtle shadow-lg',
            )}
          >
            <div className="flex items-start gap-2">
              <Quote className="h-3.5 w-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary line-clamp-2">
                  {source.title}
                </p>
                {source.source && (
                  <p className="text-xs text-text-muted mt-0.5">
                    {source.source}
                    {source.publishedAt && ` • ${source.publishedAt}`}
                  </p>
                )}
                {source.snippet && (
                  <p className="text-xs text-text-secondary mt-1.5 line-clamp-2">
                    {source.snippet}
                  </p>
                )}
                {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Visit source
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

interface CitationListProps {
  sources: CitationSource[];
  title?: string;
  collapsed?: boolean;
  className?: string;
}

/**
 * CitationList - Expandable list of all sources at the end of a response
 */
export function CitationList({
  sources,
  title = 'Sources',
  collapsed: initialCollapsed = true,
  className,
}: CitationListProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  if (sources.length === 0) return null;

  return (
    <div className={cn('mt-4 pt-4 border-t border-border-subtle', className)}>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors w-full"
      >
        <FileText className="h-4 w-4" />
        <span>{title}</span>
        <span className="text-xs text-text-muted bg-surface-3 px-1.5 py-0.5 rounded">
          {sources.length}
        </span>
        <div className="flex-1" />
        {isCollapsed ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronUp className="h-4 w-4" />
        )}
      </button>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              {sources.map((source, index) => (
                <CitationCard key={source.id} source={source} number={index + 1} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface CitationCardProps {
  source: CitationSource;
  number: number;
}

/**
 * CitationCard - Individual source card in the citation list
 */
function CitationCard({ source, number }: CitationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: number * 0.05 }}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg',
        'bg-surface-2 hover:bg-surface-3 transition-colors',
        'group'
      )}
    >
      <span className="flex items-center justify-center w-5 h-5 text-xs font-medium rounded bg-blue-500/20 text-blue-400 flex-shrink-0">
        {number}
      </span>

      <div className="flex-1 min-w-0">
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-text-primary hover:text-blue-400 transition-colors line-clamp-1"
        >
          {source.title}
        </a>

        {source.source && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <Link2 className="h-3 w-3 text-text-muted" />
            <span className="text-xs text-text-muted truncate">
              {source.source}
            </span>
            {source.relevance !== undefined && (
              <span className={cn(
                'text-[10px] px-1 py-0.5 rounded',
                source.relevance > 0.8
                  ? 'bg-green-500/20 text-green-400'
                  : source.relevance > 0.6
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-gray-500/20 text-gray-400'
              )}>
                {Math.round(source.relevance * 100)}% match
              </span>
            )}
          </div>
        )}

        {source.snippet && (
          <p className="text-xs text-text-secondary mt-1 line-clamp-2">
            {source.snippet}
          </p>
        )}
      </div>

      {source.url && (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-surface-4 rounded"
          title="Open in new tab"
        >
          <ExternalLink className="h-4 w-4 text-text-muted" />
        </a>
      )}
    </motion.div>
  );
}

/**
 * Parse citation markers from text and extract references
 * Example: "According to [1], the data shows... [2]"
 */
export function parseCitations(
  text: string,
  sources: CitationSource[]
): Array<{ type: 'text' | 'citation'; content: string; source?: CitationSource }> {
  const parts: Array<{ type: 'text' | 'citation'; content: string; source?: CitationSource }> = [];
  const citationRegex = /\[(\d+)\]/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = citationRegex.exec(text)) !== null) {
    // Add text before the citation
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add the citation
    const citationNum = parseInt(match[1] ?? '0', 10);
    const source = sources[citationNum - 1];
    parts.push({
      type: 'citation',
      content: match[1] ?? '',
      source,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return parts;
}

InlineCitation.displayName = 'InlineCitation';
CitationList.displayName = 'CitationList';
