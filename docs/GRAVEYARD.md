# Graveyard — Deprecated & Outdated Content

Archived content removed from active skills. Preserved for historical reference only.

---

## antigravity-manager SKILL.md — Removed Content

### "Crush" Platform References
The entire skill previously referenced "Crush" as the platform. This was the old name for what is now the OpenCode plugin ecosystem. All Crush-specific paths (`crush.json`, `~/.local/share/crush/`, `crush-start.sh`) are no longer relevant to this skill's audience.

### Old Model List (Crush Provider Setup)
The previous skill included a hardcoded model list with models not present in current `opencode.json`:
- `claude-haiku-4-5-20251001`, `claude-haiku-4` — not in current config
- `claude-3-5-sonnet-20241022`, `claude-3-5-sonnet-20240620` — not in current config
- `claude-opus-4-5-20251101`, `claude-opus-4-5-thinking` — not in current config
- `claude-opus-4`, `claude-3-haiku-20240307` — not in current config
- `claude-opus-4-6-20260201`, `claude-sonnet-4-5` — not in current config
- `gpt-oss-120b-medium` — not in current config
- `gemini-3.5-flash-extra-low` — not in current config
- `gemini-3.1-flash-image` — not in current config
- `gemini-3-flash-agent` — not in current config

Current models are defined in `~/.config/opencode/opencode.json` under `provider.antigravity-manager.models` and `provider.google.models`.

### Section Numbering Gap
Previous skill had sections numbered 4, 5, 6 (implying 1-3 existed). This was confusing. Rewritten skill uses clean sequential numbering.

---

## google-oauth-accounts SKILL.md — Removed Content

### Crush-Specific Paths
- `~/.local/share/crush/crush.json` — not used in OpenCode context
- `crush.json` global config — not relevant

### Old Plugin Cache Paths
Previous skill referenced these cache paths that may not exist or may be stale:
- `~/.cache/opencode/packages/opencode-antigravity-auth@latest/node_modules/opencode-antigravity-auth/`
- `dist/src/constants.js` — old plugin structure (now `dist/plugin/`)
- `dist/src/plugin/version.js` — old plugin structure
- `~/.config/opencode/plugins/antigravity-quota/dist/quota-client.js` — unknown path

### Old Plugin Internal File References
- `plugin.js` — old monolithic structure, now split into `plugin/` directory
- `storage.js` — now `plugin/storage.ts`
- `accounts.js` — now `plugin/accounts.ts`
- `BANNED_EMAILS` / `FORCE_ENABLED` patch — workaround for old verification loop bug, may not be needed

### Outdated Deploy & Backup Section
Referenced old cache paths and `opencode-antigravity-auth@latest` package name. Current deployment is via `npm run build` in the ocagvrotate repo, loading from `file:///home/yapilwsl/arthityap/ocagvrotate/dist/index.js`.

### Missing Current State
- Current account count: 6 accounts (was not documented)
- Current `antigravity.json` config values (scheduling_mode, failure_ttl, etc.)
- Current model routing: manager path is primary, google path is legacy/fallback
- `__cloudCodeMeta` SDK patch fix (provider-utils parseJsonEventStream)

---

## Why These Were Removed

Both skills were written during the "Crush" era and never fully updated for the OpenCode plugin era. They contained:
1. Stale paths that don't exist on current systems
2. References to "Crush" platform that no longer applies
3. Model lists that don't match current `opencode.json`
4. Plugin internal file references from old monolithic structure
5. Missing critical current-state info (SDK patch, current config, current model routing)

The rewritten skills focus on current reality only.
