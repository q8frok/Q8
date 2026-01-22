'use client';

import React from 'react';

/**
 * Suggestion Chip Component
 */
export function SuggestionChip({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-xs bg-surface-3 border border-border-subtle hover:bg-neon-primary/10 hover:border-neon-primary/30 transition-colors focus-ring"
    >
      {children}
    </button>
  );
}
