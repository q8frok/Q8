# MCP Setup Notes (Q8)

## Current status
- `mcporter` CLI is installed and available.
- Existing global config already includes Home Assistant MCP (workspace-level config).

## Supabase MCP (template)
A project template is now included at:
- `config/mcporter.template.json`

To activate for this project:
1. Copy template to `config/mcporter.json` in project root.
2. Replace placeholders:
   - `<SUPABASE_MCP_ACCESS_TOKEN>`
   - `<PROJECT_REF>`
3. Validate:
   ```bash
   mcporter --config ./config/mcporter.json list
   mcporter --config ./config/mcporter.json list supabase --schema
   ```

## Why template-first
Keeps secrets out of git and lets staging/prod switch via config files.

## Recommended follow-up
- Keep separate MCP config files by environment:
  - `config/mcporter.staging.json`
  - `config/mcporter.prod.json`
- Use staging by default during development.
