-- 026_lifeos_phase28_provenance.sql
-- Phase 2.8: provenance + idempotency + run observability

alter table if exists public.work_ops_snapshots
  add column if not exists source_record_id text,
  add column if not exists captured_at timestamptz not null default now(),
  add column if not exists ingestion_version text not null default 'phase2.8';

create unique index if not exists work_ops_snapshots_source_record_uidx
  on public.work_ops_snapshots(source, source_record_id)
  where source_record_id is not null;

create index if not exists work_ops_snapshots_captured_at_idx
  on public.work_ops_snapshots(captured_at desc);
