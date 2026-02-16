'use client';

import { Activity, AlertTriangle, Briefcase, Brain, ShieldCheck, Users, TrendingUp } from 'lucide-react';
import { WidgetWrapper } from './WidgetWrapper';

export type LifeOSDomainKind =
  | 'work-ops'
  | 'approvals'
  | 'health'
  | 'knowledge'
  | 'people'
  | 'growth'
  | 'alerts';

const DOMAIN_META: Record<LifeOSDomainKind, { title: string; subtitle: string; icon: any }> = {
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

  return (
    <WidgetWrapper title={meta.title} icon={Icon} colSpan={2} rowSpan={1}>
      <div className="h-full p-4 flex items-center justify-between gap-4">
        <p className="text-sm text-text-muted leading-relaxed">{meta.subtitle}</p>
        <span className="text-xs px-2 py-1 rounded-md bg-neon-primary/15 text-neon-primary whitespace-nowrap">
          Phase 1 Scaffold
        </span>
      </div>
    </WidgetWrapper>
  );
}

export default LifeOSDomainWidget;
