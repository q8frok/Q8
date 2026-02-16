'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';

export interface RunInspectorEvent {
  id: string;
  type: string;
  timestamp: Date;
  summary: string;
}

interface RunInspectorPanelProps {
  events: RunInspectorEvent[];
  className?: string;
}

/**
 * RunInspectorPanel
 * Compact live timeline for routing/tool/run events during a chat run.
 */
export const RunInspectorPanel = memo(function RunInspectorPanel({ events, className }: RunInspectorPanelProps) {
  return (
    <aside className={cn('h-full flex flex-col border-l border-border-subtle bg-surface-2/40', className)}>
      <div className="px-4 py-3 border-b border-border-subtle">
        <h3 className="text-sm font-semibold text-text-primary">Run Inspector</h3>
        <p className="text-xs text-text-muted mt-0.5">Live interaction timeline</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {events.length === 0 ? (
          <div className="text-xs text-text-muted px-1">No events yet — send a message to start a run.</div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="rounded-lg border border-border-subtle bg-surface-1/60 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wide text-neon-primary">{event.type.replace('_', ' ')}</span>
                <span className="text-[11px] text-text-muted">{event.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">{event.summary}</p>
            </div>
          ))
        )}
      </div>
    </aside>
  );
});

RunInspectorPanel.displayName = 'RunInspectorPanel';
