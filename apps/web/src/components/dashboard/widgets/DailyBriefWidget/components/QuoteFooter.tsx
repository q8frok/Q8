'use client';

import { Quote } from 'lucide-react';
import type { Quote as QuoteType } from '../types';

interface QuoteFooterProps {
  quote: QuoteType;
}

export function QuoteFooter({ quote }: QuoteFooterProps) {
  return (
    <div className="p-4 border-t border-white/5 bg-white/[0.02]">
      <div className="flex items-start gap-3">
        <Quote className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-white/70 italic">&ldquo;{quote.text}&rdquo;</p>
          <p className="text-xs text-white/40 mt-1">&mdash; {quote.author}</p>
        </div>
      </div>
    </div>
  );
}
