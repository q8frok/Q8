-- 023_lifeos_phase2.sql
-- Phase 2 scaffolding tables for Life OS approvals and alert thresholds

create table if not exists public.approval_queue (
  id text primary key,
  title text not null,
  domain text not null check (domain in ('work-ops','finance','home','personal')),
  severity text not null check (severity in ('green','yellow','red')),
  status text not null check (status in ('pending','approved','rejected')) default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists approval_queue_status_idx on public.approval_queue(status);
create index if not exists approval_queue_created_at_idx on public.approval_queue(created_at desc);

create table if not exists public.alert_thresholds (
  id bigint generated always as identity primary key,
  domain text not null,
  metric text not null,
  operator text not null,
  threshold numeric not null,
  severity text not null check (severity in ('info','warning','critical')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(domain, metric, operator, severity)
);

create index if not exists alert_thresholds_enabled_idx on public.alert_thresholds(enabled);

-- Seed defaults (idempotent)
insert into public.alert_thresholds (domain, metric, operator, threshold, severity)
values
  ('work-ops', 'catering_lead_time_hours', '<=', 72, 'critical'),
  ('finance', 'dining_spend_delta_pct_7d', '>=', 25, 'warning'),
  ('home', 'night_scene_missed_count_24h', '>=', 1, 'info')
on conflict (domain, metric, operator, severity) do nothing;
