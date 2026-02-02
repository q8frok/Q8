'use client';

import { Sparkles } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';

interface SummarySectionProps {
  summary: string;
  isOpen: boolean;
  onToggle: () => void;
}

export function SummarySection({ summary, isOpen, onToggle }: SummarySectionProps) {
  return (
    <CollapsibleSection
      icon={<Sparkles className="w-4 h-4 text-purple-400" />}
      title="Today's Summary"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <p className="text-sm text-white/80 leading-relaxed">{summary}</p>
    </CollapsibleSection>
  );
}
