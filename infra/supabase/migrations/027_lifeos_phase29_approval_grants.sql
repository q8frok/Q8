-- 027_lifeos_phase29_approval_grants.sql
-- Phase 2.9: one-time approval grants for yellow policy

create table if not exists public.approval_grants (
  id bigint generated always as identity primary key,
  action_key text not null unique,
  source_approval_id text,
  active boolean not null default true,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists approval_grants_active_idx
  on public.approval_grants(active);
