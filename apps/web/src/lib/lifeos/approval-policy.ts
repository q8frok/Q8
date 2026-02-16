import { supabaseAdmin } from '@/lib/supabase/server';

type Domain = 'work-ops' | 'finance' | 'home' | 'personal';
type Severity = 'info' | 'warning' | 'critical';
type ApprovalSeverity = 'green' | 'yellow' | 'red';

type Candidate = {
  id: string;
  domain: Domain;
  title: string;
  severity: Severity;
  source: string;
  metric: string;
  value: number;
  threshold: number;
  operator: string;
};

type DispatchResult = {
  autoExecuted: number;
  approvalQueued: number;
  blocked: number;
  grantsUsed: number;
};

function mapApprovalSeverity(domain: Domain, metric: string, severity: Severity): ApprovalSeverity {
  // Policy: finance changes are strict; operational changes require one-time approval; low-risk home automations can auto-run
  if (domain === 'finance') return 'red';
  if (domain === 'work-ops' && metric === 'catering_lead_time_hours') return 'yellow';
  if (domain === 'home' && severity === 'info') return 'green';
  return severity === 'critical' ? 'red' : 'yellow';
}

function actionKey(c: Candidate): string {
  return `${c.domain}:${c.metric}:${c.operator}:${c.threshold}`;
}

function approvalTitle(c: Candidate, level: ApprovalSeverity): string {
  return `[${level.toUpperCase()}] ${c.domain} action gate — ${c.metric} ${c.operator} ${c.threshold} (value=${c.value})`;
}

async function hasApprovedGrant(key: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('approval_grants')
    .select('id,active')
    .eq('action_key', key)
    .eq('active', true)
    .maybeSingle();

  if (error) return false;
  return Boolean(data?.id);
}

async function queueApprovalIfMissing(c: Candidate, level: ApprovalSeverity): Promise<boolean> {
  const key = actionKey(c);

  const { data: existing, error: readErr } = await supabaseAdmin
    .from('approval_queue')
    .select('id,status')
    .eq('status', 'pending')
    .contains('metadata', { actionKey: key })
    .limit(1)
    .maybeSingle();

  if (readErr) {
    // best-effort fallback: queue by id if read failed
  }

  if (existing?.id) return false;

  const item = {
    id: `ap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: approvalTitle(c, level),
    domain: c.domain,
    severity: level,
    status: 'pending',
    metadata: {
      actionKey: key,
      metric: c.metric,
      value: c.value,
      operator: c.operator,
      threshold: c.threshold,
      sourceEventId: c.id,
      policy: level,
    },
  };

  const { error } = await supabaseAdmin.from('approval_queue').insert(item);
  return !error;
}

async function recordAutoAction(c: Candidate, reason: string) {
  await supabaseAdmin.from('alert_events').insert({
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    domain: c.domain,
    title: `AUTO ACTION (${reason}) — ${c.metric} ${c.operator} ${c.threshold} (value=${c.value})`,
    severity: c.severity,
    source: 'phase2.9_policy_dispatch',
  });
}

export async function dispatchWithApprovalPolicy(candidates: Candidate[]): Promise<DispatchResult> {
  let autoExecuted = 0;
  let approvalQueued = 0;
  let blocked = 0;
  let grantsUsed = 0;

  for (const c of candidates) {
    const level = mapApprovalSeverity(c.domain, c.metric, c.severity);
    const key = actionKey(c);

    if (level === 'green') {
      await recordAutoAction(c, 'green');
      autoExecuted += 1;
      continue;
    }

    if (level === 'yellow') {
      const granted = await hasApprovedGrant(key);
      if (granted) {
        await recordAutoAction(c, 'yellow-approved-once');
        autoExecuted += 1;
        grantsUsed += 1;
      } else {
        const queued = await queueApprovalIfMissing(c, level);
        if (queued) approvalQueued += 1;
        blocked += 1;
      }
      continue;
    }

    // red: always block and request explicit approval each time
    const queued = await queueApprovalIfMissing(c, level);
    if (queued) approvalQueued += 1;
    blocked += 1;
  }

  return { autoExecuted, approvalQueued, blocked, grantsUsed };
}
