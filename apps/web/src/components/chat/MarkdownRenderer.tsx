'use client';

import { useMemo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Markdown renderer with syntax-highlighted code blocks
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);

  const handleCopyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedBlock(code);
    setTimeout(() => setCopiedBlock(null), 2000);
  }, []);

  const markdownComponents = useMemo(() => ({
    // Handle block code (pre > code) - extract code element and render with syntax highlighting
    pre({ children }: { children?: React.ReactNode }) {
      const codeElement = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
      const codeClassName = codeElement?.props?.className || '';
      const codeContent = codeElement?.props?.children;
      const match = /language-(\w+)/.exec(codeClassName);
      const language = match ? match[1] : '';
      const codeString = String(codeContent).replace(/\n$/, '');
      const isCopied = copiedBlock === codeString;

      return (
        <div className="relative group/code my-3">
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
            {language && (
              <span className="px-2 py-1 bg-surface-3 border border-border-subtle rounded text-xs text-text-muted">
                {language}
              </span>
            )}
            <button
              onClick={() => handleCopyCode(codeString)}
              className="px-2 py-1 bg-surface-3 border border-border-subtle rounded text-xs text-text-muted hover:text-text-primary hover:bg-surface-4 transition-colors opacity-0 group-hover/code:opacity-100 focus:opacity-100"
              title="Copy code"
            >
              {isCopied ? <Check className="h-3 w-3 text-neon-accent" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
          <div className="overflow-x-auto -webkit-overflow-scrolling-touch rounded-lg">
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={language || 'text'}
              PreTag="div"
              className="rounded-lg !bg-black/30 !p-4 !text-[13px]"
            >
              {codeString}
            </SyntaxHighlighter>
          </div>
        </div>
      );
    },
    // Inline code only (not wrapped in pre)
    code({ className: codeClassName, children, ...props }: { className?: string; children?: React.ReactNode }) {
      return (
        <code className={cn('px-1.5 py-0.5 rounded bg-surface-3 text-neon-accent text-[13px]', codeClassName)} {...props}>
          {children}
        </code>
      );
    },
    // Ensure paragraphs render correctly with better spacing
    p({ children }: { children?: React.ReactNode }) {
      return <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>;
    },
    // Lists with improved mobile spacing
    li({ children }: { children?: React.ReactNode }) {
      return <li className="my-1">{children}</li>;
    },
    // Links with external indicator
    a({ href, children, ...props }: { href?: string; children?: React.ReactNode }) {
      const isExternal = href && (href.startsWith('http://') || href.startsWith('https://'));
      return (
        <a
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="text-neon-primary hover:underline inline-flex items-center gap-0.5"
          {...props}
        >
          {children}
          {isExternal && <ExternalLink className="h-3 w-3 inline-block flex-shrink-0" />}
        </a>
      );
    },
    // Tables wrapped for mobile horizontal scroll
    table({ children }: { children?: React.ReactNode }) {
      return (
        <div className="overflow-x-auto -webkit-overflow-scrolling-touch my-3 rounded-lg border border-border-subtle">
          <table className="min-w-full text-sm">{children}</table>
        </div>
      );
    },
  }), [copiedBlock, handleCopyCode]);

  return (
    <div className={className}>
      <ReactMarkdown components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

MarkdownRenderer.displayName = 'MarkdownRenderer';
