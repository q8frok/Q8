'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import type { AlertsResponse, AlertSeverity } from '@/types/alerts';

const severityClass: Record<AlertSeverity, string> = {
  info: 'bg-sky-500/20 text-sky-300',
  warning: 'bg-amber-500/20 text-amber-300',
  critical: 'bg-rose-500/20 text-rose-300',
};

export function AlertsWidget() {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [thresholdCount, setThresholdCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [alertsRes, thresholdsRes] = await Promise.all([
          fetch('/api/lifeos/alerts', { cache: 'no-store' }),
          fetch('/api/lifeos/thresholds', { cache: 'no-store' }),
        ]);

        if (alertsRes.ok) {
          const json = (await alertsRes.json()) as AlertsResponse;
          if (mounted) setData(json);
        }

        if (thresholdsRes.ok) {
          const thresholdsJson = (await thresholdsRes.json()) as { items?: unknown[] };
          if (mounted) setThresholdCount((thresholdsJson.items ?? []).length);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const top = useMemo(() => (data?.items ?? []).slice(0, 3), [data]);

  return (
    <WidgetWrapper title="Risk & Alerts" icon={AlertTriangle} colSpan={2} rowSpan={1} isLoading={isLoading}>
      <div className="p-4 space-y-2">
        <p className="text-[11px] text-text-muted">Active thresholds: {thresholdCount}</p>
        {top.length === 0 ? (
          <p className="text-sm text-text-muted">No active alerts.</p>
        ) : (
          top.map((item) => (
            <div key={item.id} className="rounded-md bg-surface-3 px-3 py-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-text-secondary">{item.title}</p>
                <p className="text-[11px] text-text-muted">{item.domain}</p>
              </div>
              <span className={`text-[11px] px-1.5 py-0.5 rounded ${severityClass[item.severity]}`}>
                {item.severity.toUpperCase()}
              </span>
            </div>
          ))
        )}
      </div>
    </WidgetWrapper>
  );
}

export default AlertsWidget;
