# Q8 Life OS – Tech Decision Matrix (v1)

Date: 2026-02-15

## Goal
Build a practical, approval-safe Life OS across work ops, personal finance, smart home, and execution automation.

## Recommended stack by domain

## 1) Smart Home Autonomy

**Primary:** Home Assistant + Matter/Thread-first strategy
- Why: strongest open ecosystem, local-first control, broad device support
- Add-ons:
  - EMHASS for energy optimization/scheduling
  - n8n for cross-platform workflow orchestration

Decision: **Adopt**

## 2) Ops Automation (reservations, ordering, scheduling)

**Primary:** n8n + Google (Gmail/Calendar/Sheets) + custom Q8 workflow service
- Why: quick automation delivery + transparent workflows + easy approvals
- Pattern: intake -> normalize -> draft action -> approval -> execution

Decision: **Adopt**

## 3) Personal Finance Intelligence

**Primary data rail:** Plaid (existing integration path in Q8)

Ledger options:
- **Firefly III**: self-hosted, API-rich, deep control
- **Actual Budget**: simpler UX, local-first budgeting

Recommendation:
- Start with Q8 + Plaid + internal categories/anomaly engine
- Evaluate Firefly III if strict self-hosted ledger workflows are needed

Decision: **Adopt phased approach**

## 4) Investment/Income Automation

Approach:
- Stage 1: research and signal briefs only
- Stage 2: paper-trading simulation with fixed risk limits
- Stage 3: limited live allocation, strict approvals and circuit breakers

Important:
- No fully autonomous capital deployment without explicit user approval and risk policy.

Decision: **Adopt staged model**

## 5) Dashboard + Agentic App Platform

**Primary:** Next.js + Vercel + AI SDK patterns + approval middleware
- Why: fast iteration, preview deployments, strong DX

Decision: **Adopt**

## 6) Coding and delivery workflow

- GitHub flow with protected `main`
- PR checks: typecheck/lint/test/build
- Claude Code for implementation loops + human review before merge

Decision: **Adopt**

## Architecture principles

1. Approval-first external actions
2. Local-first for private/sensitive domains where possible
3. Event-log everything (auditability)
4. Fail closed on high-risk actions
5. Separate environments (dev/staging/prod)

## Immediate next implementation targets

1. Safe environment baseline (branch rules, CI, env separation)
2. Reservation command center ingestion (Gmail + Calendar)
3. Inventory draft workflow with approval queue
4. Finance daily mini + weekly deep summary pipeline
5. Home Assistant policy-based automations (night-shift mode)
