'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Briefcase, Brain, ShieldCheck, Users, TrendingUp, type LucideIcon } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';
import type { LifeOSDomainKind, LifeOSOverview } from '@/types/lifeos';

const DOMAIN_META: Record<LifeOSDomainKind, { title: string; subtitle: string; icon: LucideIcon }> = {
  'work-ops': {
    title: 'Work Ops Command',
    subtitle: 'Reservations, staffing, inventory and vendor execution queue.',
    icon: Briefcase,
  },
  approvals: {
    title: 'Approval Center',
    subtitle: 'Green/Yellow/Red actions with review and approval controls.',
    icon: ShieldCheck,
  },
  health: {
    title: 'Health Protocol',
    subtitle: 'Night-shift sleep, hydration, meal timing, and training cadence.',
    icon: Activity,
  },
  knowledge: {
    title: 'Knowledge OS',
    subtitle: 'Notes distillation, idea-to-action pipelines, and memory index.',
    icon: Brain,
  },
  people: {
    title: 'People & Follow-up',
    subtitle: 'Relationship cadence, outreach reminders, and commitments.',
    icon: Users,
  },
  growth: {
    title: 'Growth Engine',
    subtitle: 'Weekly leverage plays, experiments, and optimization backlog.',
    icon: TrendingUp,
  },
  alerts: {
    title: 'Risk & Alerts',
    subtitle: 'Cross-domain anomalies, blockers, and urgent action feed.',
    icon: AlertTriangle,
  },
};

export function LifeOSDomainWidget({ kind }: { kind: LifeOSDomainKind }) {
  const meta = DOMAIN_META[kind];
  const Icon = meta.icon;

  const [overview, setOverview] = useState<LifeOSOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadOverview() {
      try {
        const res = await fetch('/api/lifeos/overview', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as LifeOSOverview;
        if (mounted) setOverview(json);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadOverview();
    return () => {
      mounted = false;
    };
  }, []);

  const domain = useMemo(
    () => overview?.domains.find((d) => d.kind === kind) ?? null,
    [overview, kind]
  );

  return (
    <WidgetWrapper title={meta.title} icon={Icon} colSpan={2} rowSpan={1} isLoading={isLoading}>
      <div className="h-full p-4 flex flex-col gap-3">
        <p className="text-sm text-text-muted leading-relaxed">{meta.subtitle}</p>

        {domain && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md bg-surface-3 px-2 py-1.5">
              <div className="text-[11px] text-text-muted">Score</div>
              <div className="text-sm font-semibold">{domain.score}</div>
            </div>
            <div className="rounded-md bg-surface-3 px-2 py-1.5">
              <div className="text-[11px] text-text-muted">Open</div>
              <div className="text-sm font-semibold">{domain.openItems}</div>
            </div>
            <div className="rounded-md bg-surface-3 px-2 py-1.5">
              <div className="text-[11px] text-text-muted">Urgent</div>
              <div className="text-sm font-semibold text-orange-300">{domain.urgentItems}</div>
            </div>
          </div>
        )}

        <div className="text-xs text-neon-primary/90 truncate">
          Next: {domain?.nextAction ?? 'Wiring this domain data contract...'}
        </div>
      </div>
    </WidgetWrapper>
  );
}

export default LifeOSDomainWidget;
