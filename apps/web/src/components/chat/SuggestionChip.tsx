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
      className="px-3.5 py-2 sm:py-1.5 rounded-full text-xs bg-surface-3 border border-border-subtle hover:bg-neon-primary/10 hover:border-neon-primary/30 active:scale-[0.97] transition-all focus-ring"
    >
      {children}
    </button>
  );
}
