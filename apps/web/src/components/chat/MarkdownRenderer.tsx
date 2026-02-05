'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Markdown renderer with syntax-highlighted code blocks
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const markdownComponents = useMemo(() => ({
    // Handle block code (pre > code) - extract code element and render with syntax highlighting
    pre({ children }: { children?: React.ReactNode }) {
      const codeElement = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
      const codeClassName = codeElement?.props?.className || '';
      const codeContent = codeElement?.props?.children;
      const match = /language-(\w+)/.exec(codeClassName);
      const language = match ? match[1] : '';
      const codeString = String(codeContent).replace(/\n$/, '');

      return (
        <div className="relative group/code my-3">
          {language && (
            <div className="absolute top-2 right-2 z-10 px-2 py-1 bg-surface-3 border border-border-subtle rounded text-xs text-text-muted">
              {language}
            </div>
          )}
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={language || 'text'}
            PreTag="div"
            className="rounded-lg !bg-black/30 !p-4"
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    },
    // Inline code only (not wrapped in pre)
    code({ className: codeClassName, children, ...props }: { className?: string; children?: React.ReactNode }) {
      return (
        <code className={cn('px-1 py-0.5 rounded bg-surface-3 text-neon-accent text-sm', codeClassName)} {...props}>
          {children}
        </code>
      );
    },
    // Ensure paragraphs render correctly
    p({ children }: { children?: React.ReactNode }) {
      return <p className="mb-2 last:mb-0">{children}</p>;
    },
  }), []);

  return (
    <div className={className}>
      <ReactMarkdown components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

MarkdownRenderer.displayName = 'MarkdownRenderer';
