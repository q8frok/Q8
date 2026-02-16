'use client';

import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import type { ApprovalItem, ApprovalQueueResponse } from '@/types/approvals';

const badgeClass: Record<ApprovalItem['severity'], string> = {
  green: 'bg-emerald-500/20 text-emerald-300',
  yellow: 'bg-amber-500/20 text-amber-300',
  red: 'bg-rose-500/20 text-rose-300',
};

export function ApprovalCenterWidget() {
  const [data, setData] = useState<ApprovalQueueResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch('/api/lifeos/approvals', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as ApprovalQueueResponse;
        if (mounted) setData(json);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const pending = useMemo(
    () => (data?.items ?? []).filter((i) => i.status === 'pending'),
    [data]
  );

  async function act(id: string, action: 'approve' | 'reject') {
    setActingId(id);
    try {
      await fetch('/api/lifeos/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) =>
                item.id === id ? { ...item, status: action === 'approve' ? 'approved' : 'rejected' } : item
              ),
            }
          : prev
      );
    } finally {
      setActingId(null);
    }
  }

  return (
    <WidgetWrapper title="Approval Center" icon={ShieldCheck} colSpan={2} rowSpan={1} isLoading={isLoading}>
      <div className="p-4 space-y-2">
        {pending.length === 0 ? (
          <p className="text-sm text-text-muted">No pending approvals.</p>
        ) : (
          pending.slice(0, 3).map((item) => (
            <div key={item.id} className="rounded-lg bg-surface-3 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-text-secondary truncate">{item.title}</p>
                <span className={`text-[11px] px-1.5 py-0.5 rounded ${badgeClass[item.severity]}`}>
                  {item.severity.toUpperCase()}
                </span>
              </div>
              <div className="text-[11px] text-text-muted mt-1 mb-2">{item.domain}</div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => act(item.id, 'approve')}
                  disabled={actingId === item.id}
                  className="text-[11px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => act(item.id, 'reject')}
                  disabled={actingId === item.id}
                  className="text-[11px] px-2 py-1 rounded bg-rose-500/20 text-rose-300 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </WidgetWrapper>
  );
}

export default ApprovalCenterWidget;
