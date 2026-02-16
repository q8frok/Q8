'use client';

import { useEffect, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import type { WorkOpsSnapshot } from '@/types/workops';

export function WorkOpsWidget() {
  const [data, setData] = useState<WorkOpsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch('/api/lifeos/work-ops', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as WorkOpsSnapshot;
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

  return (
    <WidgetWrapper title="Work Ops Command" icon={Briefcase} colSpan={2} rowSpan={1} isLoading={isLoading}>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Pending Replies" value={data?.reservations.pendingResponses ?? 0} />
          <Stat label="Staff Flags" value={data?.staffing.varianceFlags ?? 0} />
          <Stat label="Stockout Risks" value={data?.inventory.stockoutRisks ?? 0} />
        </div>
        <p className="text-xs text-text-muted">Today reservations: {data?.reservations.today ?? 0} · Catering this week: {data?.reservations.cateringEvents ?? 0}</p>
        <p className="text-xs text-neon-primary truncate">Next: {data?.nextAction ?? 'Loading next action...'}</p>
      </div>
    </WidgetWrapper>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-surface-3 px-2 py-1.5">
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

export default WorkOpsWidget;
