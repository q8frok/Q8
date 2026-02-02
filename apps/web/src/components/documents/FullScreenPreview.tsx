'use client';

/**
 * FullScreenPreview
 * Modal overlay for full-screen document preview
 */

import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import type { Document, DocumentChunk } from '@/lib/documents/types';

interface FullScreenPreviewProps {
  doc: Document;
  chunks: DocumentChunk[];
  signedUrl?: string;
  onClose: () => void;
}

export function FullScreenPreview({ doc, chunks, signedUrl, onClose }: FullScreenPreviewProps) {
  const [zoom, setZoom] = React.useState(1);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const content = (() => {
    const fileType = doc.fileType;

    if (fileType === 'pdf' && signedUrl) {
      return (
        <iframe
          src={signedUrl}
          className="w-full h-full rounded-lg"
          title="PDF full-screen preview"
        />
      );
    }

    if (fileType === 'image' && signedUrl) {
      return (
        <div
          className="w-full h-full flex items-center justify-center overflow-auto"
          onWheel={(e) => {
            e.preventDefault();
            setZoom((prev) => Math.max(0.25, Math.min(5, prev + (e.deltaY > 0 ? -0.1 : 0.1))));
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signedUrl}
            alt={doc.name}
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            className="max-w-none transition-transform duration-100"
          />
        </div>
      );
    }

    if (fileType === 'code') {
      return (
        <div className="w-full h-full overflow-auto p-8">
          <div className="max-w-4xl mx-auto">
            {chunks.map((chunk) => (
              <div key={chunk.id} className="relative mb-4">
                {chunk.sourceLineStart && (
                  <div className="absolute top-2 right-2 text-xs text-white/30 font-mono">
                    L{chunk.sourceLineStart}
                    {chunk.sourceLineEnd ? `\u2013${chunk.sourceLineEnd}` : ''}
                  </div>
                )}
                <pre className="p-4 bg-white/5 rounded-xl overflow-x-auto text-sm text-white/80 font-mono leading-relaxed whitespace-pre">
                  {chunk.content.split('\n').map((line, i) => (
                    <span key={i} className="block">
                      <span className="inline-block w-12 text-right mr-4 text-white/20 select-none">
                        {(chunk.sourceLineStart || 0) + i}
                      </span>
                      {line}
                    </span>
                  ))}
                </pre>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Text/markdown/doc: comfortable reading width
    return (
      <div className="w-full h-full overflow-auto p-8">
        <div className="max-w-3xl mx-auto prose prose-invert prose-base">
          {chunks.map((chunk) => (
            <div key={chunk.id} className="mb-4">
              {chunk.chunkType === 'heading' ? (
                <h3 className="font-semibold text-white text-lg mt-6 mb-2">
                  {chunk.content}
                </h3>
              ) : (
                <p className="text-base text-white/80 whitespace-pre-wrap leading-relaxed">
                  {chunk.content}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  })();

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/50">
        <h2 className="text-white font-medium truncate">{doc.name}</h2>
        <div className="flex items-center gap-2">
          {doc.fileType === 'image' && signedUrl && (
            <>
              <button
                onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-sm text-white/50 min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
                className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close full-screen preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {content}
      </div>
    </div>,
    window.document.body
  );
}

export default FullScreenPreview;
