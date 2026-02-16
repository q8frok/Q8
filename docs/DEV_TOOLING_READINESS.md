# Dev Tooling Readiness (Mac) — Q8

Updated: 2026-02-15

## Installed and verified

- Claude Code: `2.1.39`
- Codex CLI: `0.101.0`
- n8n: `1.64.3`
- mcporter: `0.7.3`
- Skills CLI (`npx skills`): available

## skills.sh (Vercel) installed globally

Installed from `vercel-labs/agent-skills` to all agents:
- `vercel-react-best-practices`
- `vercel-composition-patterns`
- `web-design-guidelines`

Location:
- `~/.agents/skills/*`

## Claude config compatibility fixes applied

File updated: `.claude/settings.json`

- Project root changed from Windows path to Mac path:
  - `C:\Users\Minki\Q8` -> `/Users/q8macmini/.openclaw/workspace/Q8`
- Notification hook changed from PowerShell beep to macOS-compatible sound command.

## Shell PATH fix

Added `~/.npm-global/bin` to:
- `~/.zshrc`
- `~/.zprofile`

This ensures globally installed CLIs (codex, n8n, etc.) are available in terminal sessions.

## MCP/tooling status

- `mcporter` installed and available.
- Project has `.claude` MCP preferences configured (serena/supabase/github priority).
- Next step when coding starts: validate live MCP auth/session per provider (GitHub, Supabase, Google, etc.) and log pass/fail in a checklist.

## Next recommended validation commands

Run from project root:

```bash
cd /Users/q8macmini/.openclaw/workspace/Q8
claude --version
codex --version
n8n --version
mcporter --version
npx skills ls -g
```
