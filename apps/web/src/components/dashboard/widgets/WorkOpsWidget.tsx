'use client';

import { useEffect, useMemo, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import type { WorkOpsSnapshot } from '@/types/workops';

type Connector = { configured: boolean; status: string };
type PipelineStatus = {
  nextDueAt: string | null;
  lastRun: { status: 'success' | 'failed'; finished_at: string; duration_ms: number } | null;
};

export function WorkOpsWidget() {
  const [data, setData] = useState<WorkOpsSnapshot | null>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [jobStatus, setJobStatus] = useState<PipelineStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIngesting, setIsIngesting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadStatusAndMaybeRun() {
      const statusRes = await fetch('/api/lifeos/jobs/phase27/status', { cache: 'no-store' });
      if (!statusRes.ok) return null;
      const statusJson = (await statusRes.json()) as PipelineStatus;
      if (mounted) setJobStatus(statusJson);

      if (statusJson?.nextDueAt) {
        const due = new Date(statusJson.nextDueAt).getTime();
        if (Date.now() >= due) {
          await fetch('/api/lifeos/jobs/phase27/run', { method: 'POST' });
          const refresh = await fetch('/api/lifeos/jobs/phase27/status', { cache: 'no-store' });
          if (refresh.ok && mounted) {
            const refreshed = (await refresh.json()) as PipelineStatus;
            setJobStatus(refreshed);
          }
        }
      }

      return statusJson;
    }

    async function load() {
      try {
        await loadStatusAndMaybeRun();

        const [snapshotRes, sourceRes] = await Promise.all([
          fetch('/api/lifeos/work-ops', { cache: 'no-store' }),
          fetch('/api/lifeos/work-ops/sources', { cache: 'no-store' }),
        ]);

        if (snapshotRes.ok) {
          const json = (await snapshotRes.json()) as WorkOpsSnapshot;
          if (mounted) setData(json);
        }

        if (sourceRes.ok) {
          const sourceJson = (await sourceRes.json()) as { connectors?: Connector[] };
          if (mounted) setConnectors(sourceJson.connectors ?? []);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    load();
    const timer = setInterval(() => {
      loadStatusAndMaybeRun().catch(() => {});
    }, 5 * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const configuredConnectors = useMemo(
    () => connectors.filter((c) => c.configured).length,
    [connectors]
  );

  async function runIngest() {
    setIsIngesting(true);
    try {
      await fetch('/api/lifeos/ingest/work-ops', { method: 'POST' });
      const res = await fetch('/api/lifeos/work-ops', { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as WorkOpsSnapshot;
        setData(json);
      }
    } finally {
      setIsIngesting(false);
    }
  }

  return (
    <WidgetWrapper title="Work Ops Command" icon={Briefcase} colSpan={2} rowSpan={1} isLoading={isLoading}>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Pending Replies" value={data?.reservations.pendingResponses ?? 0} />
          <Stat label="Staff Flags" value={data?.staffing.varianceFlags ?? 0} />
          <Stat label="Stockout Risks" value={data?.inventory.stockoutRisks ?? 0} />
          <Stat label="Connectors" value={configuredConnectors} />
        </div>
        <p className="text-xs text-text-muted">Today reservations: {data?.reservations.today ?? 0} · Catering this week: {data?.reservations.cateringEvents ?? 0}</p>
        <p className="text-xs text-neon-primary truncate">Next: {data?.nextAction ?? 'Loading next action...'}</p>
        {jobStatus?.lastRun && (
          <p className="text-[11px] text-text-muted">
            Pipeline: {jobStatus.lastRun.status.toUpperCase()} · {jobStatus.lastRun.duration_ms}ms
          </p>
        )}
        <div>
          <button
            onClick={runIngest}
            disabled={isIngesting}
            className="text-[11px] px-2 py-1 rounded bg-neon-primary/20 text-neon-primary disabled:opacity-50"
          >
            {isIngesting ? 'Ingesting…' : 'Run Ingest'}
          </button>
        </div>
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
