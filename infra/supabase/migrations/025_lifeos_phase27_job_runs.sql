-- 025_lifeos_phase27_job_runs.sql
-- Phase 2.7: job run history for ingest + alert generation pipeline

create table if not exists public.lifeos_job_runs (
  id bigint generated always as identity primary key,
  job_name text not null,
  status text not null check (status in ('success','failed')),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_ms integer not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lifeos_job_runs_job_name_created_at_idx
  on public.lifeos_job_runs(job_name, created_at desc);
