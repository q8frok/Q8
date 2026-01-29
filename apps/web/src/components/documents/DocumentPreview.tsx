'use client';

/**
 * DocumentPreview
 * Renders document content preview based on file type
 */

import React, { useState, useEffect } from 'react';
import { Loader2, FileText, AlertCircle } from 'lucide-react';
import type { Document, DocumentChunk, FileType } from '@/lib/documents/types';

interface DocumentPreviewProps {
  /** Document to preview */
  document: Document;
  /** Pre-fetched chunks (optional, will fetch if not provided) */
  chunks?: DocumentChunk[];
  /** Signed URL for direct file rendering (images, PDFs) */
  signedUrl?: string;
}

export function DocumentPreview({ document, chunks: initialChunks, signedUrl }: DocumentPreviewProps) {
  const [chunks, setChunks] = useState<DocumentChunk[]>(initialChunks || []);
  const [loading, setLoading] = useState(!initialChunks || initialChunks.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  // Sync when parent provides chunks
  useEffect(() => {
    if (initialChunks && initialChunks.length > 0) {
      setChunks(initialChunks);
      setLoading(false);
      setFetchAttempted(true);
    }
  }, [initialChunks]);

  // Self-fetch if no chunks provided after mount
  useEffect(() => {
    if (fetchAttempted) return;
    if (initialChunks && initialChunks.length > 0) return;

    // For image/pdf with signed URL but no chunks, don't need to fetch
    if (['image', 'pdf'].includes(document.fileType) && signedUrl) {
      setLoading(false);
      setFetchAttempted(true);
      return;
    }

    async function fetchChunks() {
      try {
        const response = await fetch(`/api/documents/${document.id}`);
        const data = await response.json();
        if (data.success && data.document?.chunks) {
          setChunks(data.document.chunks);
        } else {
          setError('Failed to load document content');
        }
      } catch {
        setError('Failed to load document content');
      } finally {
        setLoading(false);
        setFetchAttempted(true);
      }
    }

    // Short delay to allow parent to provide chunks first
    const timer = setTimeout(fetchChunks, 300);
    return () => clearTimeout(timer);
  }, [document.id, document.fileType, signedUrl, initialChunks, fetchAttempted]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-red-400">
        <AlertCircle className="w-5 h-5 mr-2" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderPreview(document.fileType, chunks, signedUrl)}
    </div>
  );
}

function renderPreview(
  fileType: FileType,
  chunks: DocumentChunk[],
  signedUrl?: string
) {
  switch (fileType) {
    case 'image':
      return <ImagePreview signedUrl={signedUrl} />;
    case 'pdf':
      return <PdfPreview signedUrl={signedUrl} chunks={chunks} />;
    case 'csv':
    case 'xlsx':
    case 'xls':
      return <TablePreview chunks={chunks} />;
    case 'json':
      return <JsonPreview chunks={chunks} />;
    case 'code':
      return <CodePreview chunks={chunks} />;
    case 'pptx':
    case 'ppt':
      return <SlidePreview chunks={chunks} />;
    case 'md':
      return <MarkdownPreview chunks={chunks} />;
    case 'doc':
    case 'docx':
    case 'txt':
      return <DocumentTextPreview chunks={chunks} />;
    default:
      return <TextPreview chunks={chunks} />;
  }
}

function ImagePreview({ signedUrl }: { signedUrl?: string }) {
  if (!signedUrl) {
    return (
      <div className="flex items-center justify-center py-12 text-white/50">
        <FileText className="w-5 h-5 mr-2" />
        <span>Click Download to view this image</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4 bg-white/5 rounded-xl overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={signedUrl}
        alt="Document preview"
        className="max-w-full max-h-[500px] object-contain rounded-lg"
      />
    </div>
  );
}

function PdfPreview({ signedUrl, chunks }: { signedUrl?: string; chunks: DocumentChunk[] }) {
  if (signedUrl) {
    return (
      <iframe
        src={signedUrl}
        className="w-full h-[600px] rounded-xl border border-white/10"
        title="PDF preview"
      />
    );
  }

  return <TextPreview chunks={chunks} />;
}

function TablePreview({ chunks }: { chunks: DocumentChunk[] }) {
  const metadataChunk = chunks.find((c) => c.chunkType === 'metadata');
  const tableChunks = chunks.filter((c) => c.chunkType === 'table');

  return (
    <div className="space-y-3">
      {metadataChunk && (
        <div className="px-3 py-2 bg-white/5 rounded-lg text-sm text-white/60">
          {metadataChunk.content}
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="space-y-1">
          {tableChunks.map((chunk) => {
            const rows = chunk.content.split('\n').filter(Boolean);
            return rows.map((row, idx) => {
              try {
                const parsed = JSON.parse(row);
                return (
                  <div
                    key={`${chunk.id}-${idx}`}
                    className="flex gap-2 px-3 py-1.5 text-xs text-white/70 bg-white/5 rounded even:bg-white/[0.03]"
                  >
                    {Object.entries(parsed).map(([key, val]) => (
                      <span key={key} className="min-w-[80px]">
                        <span className="text-white/40">{key}:</span>{' '}
                        {String(val)}
                      </span>
                    ))}
                  </div>
                );
              } catch {
                return (
                  <div key={`${chunk.id}-${idx}`} className="px-3 py-1 text-xs text-white/70">
                    {row}
                  </div>
                );
              }
            });
          })}
        </div>
      </div>
    </div>
  );
}

function JsonPreview({ chunks }: { chunks: DocumentChunk[] }) {
  const content = chunks.map((c) => c.content).join('\n');

  return (
    <pre className="p-4 bg-white/5 rounded-xl overflow-x-auto text-sm text-white/80 font-mono leading-relaxed max-h-[500px] overflow-y-auto">
      {content}
    </pre>
  );
}

function CodePreview({ chunks }: { chunks: DocumentChunk[] }) {
  return (
    <div className="space-y-2">
      {chunks.map((chunk) => (
        <div key={chunk.id} className="relative">
          {chunk.sourceLineStart && (
            <div className="absolute top-2 right-2 text-xs text-white/30">
              L{chunk.sourceLineStart}
              {chunk.sourceLineEnd ? `–${chunk.sourceLineEnd}` : ''}
            </div>
          )}
          <pre className="p-4 bg-white/5 rounded-xl overflow-x-auto text-sm text-white/80 font-mono leading-relaxed">
            {chunk.content}
          </pre>
        </div>
      ))}
    </div>
  );
}

function SlidePreview({ chunks }: { chunks: DocumentChunk[] }) {
  return (
    <div className="space-y-3">
      {chunks.map((chunk) => (
        <div
          key={chunk.id}
          className="p-4 bg-white/5 rounded-xl border border-white/10"
        >
          {chunk.sourcePage && (
            <div className="text-xs text-orange-400/80 font-medium mb-2">
              Slide {chunk.sourcePage}
            </div>
          )}
          <div className="text-sm text-white/80 whitespace-pre-wrap">
            {chunk.content.replace(/^Slide \d+:\n/, '')}
          </div>
        </div>
      ))}
    </div>
  );
}

function MarkdownPreview({ chunks }: { chunks: DocumentChunk[] }) {
  return (
    <div className="space-y-2">
      {chunks.map((chunk) => (
        <div key={chunk.id} className="text-sm text-white/80">
          {chunk.chunkType === 'heading' ? (
            <h3 className="font-semibold text-white text-base mt-4 mb-1">
              {chunk.content}
            </h3>
          ) : (
            <p className="whitespace-pre-wrap leading-relaxed">{chunk.content}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function DocumentTextPreview({ chunks }: { chunks: DocumentChunk[] }) {
  if (chunks.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-white/50">
        <FileText className="w-5 h-5 mr-2" />
        <span>No content extracted from this document</span>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-6 max-h-[600px] overflow-y-auto">
      <div className="prose prose-invert prose-sm max-w-none">
        {chunks.map((chunk) => (
          <div key={chunk.id} className="mb-4 last:mb-0">
            {chunk.chunkType === 'heading' ? (
              <h3 className="font-semibold text-white text-base mt-4 mb-1">
                {chunk.content}
              </h3>
            ) : (
              <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                {chunk.content}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TextPreview({ chunks }: { chunks: DocumentChunk[] }) {
  if (chunks.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-white/50">
        <FileText className="w-5 h-5 mr-2" />
        <span>No content available</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {chunks.map((chunk) => (
        <div
          key={chunk.id}
          className="p-3 bg-white/5 rounded-lg text-sm text-white/80 whitespace-pre-wrap leading-relaxed"
        >
          {chunk.content}
        </div>
      ))}
    </div>
  );
}

export default DocumentPreview;
