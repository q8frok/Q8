-- 024_lifeos_phase25.sql
-- Phase 2.5: work ops snapshots and evaluated alerts events

create table if not exists public.work_ops_snapshots (
  id bigint generated always as identity primary key,
  reservations_this_week integer not null default 0,
  reservations_today integer not null default 0,
  pending_responses integer not null default 0,
  catering_events integer not null default 0,
  staffing_scheduled integer not null default 0,
  staffing_clocked_in integer not null default 0,
  staffing_variance_flags integer not null default 0,
  stockout_risks integer not null default 0,
  urgent_vendor_windows integer not null default 0,
  source text not null default 'system',
  created_at timestamptz not null default now()
);

create index if not exists work_ops_snapshots_created_at_idx
  on public.work_ops_snapshots(created_at desc);

create table if not exists public.alert_events (
  id text primary key,
  domain text not null,
  title text not null,
  severity text not null check (severity in ('info','warning','critical')),
  source text not null default 'threshold_engine',
  created_at timestamptz not null default now()
);

create index if not exists alert_events_created_at_idx on public.alert_events(created_at desc);

-- Seed one latest snapshot for immediate DB-mode UX
insert into public.work_ops_snapshots (
  reservations_this_week,
  reservations_today,
  pending_responses,
  catering_events,
  staffing_scheduled,
  staffing_clocked_in,
  staffing_variance_flags,
  stockout_risks,
  urgent_vendor_windows,
  source
)
values (18, 4, 3, 6, 11, 9, 2, 3, 1, 'seed')
on conflict do nothing;
