---
name: google-oauth-accounts
description: Deep operational playbook for Google OAuth account rotation, quota/rate-limit handling, model routing, diagnostics, and troubleshooting through the opencode-antigravity-auth OpenCode plugin.
---

# Google OAuth Antigravity Accounts

Use this skill for Google OAuth account rotation, quota/rate-limit rotation, model routing, plugin configuration, diagnostics, session recovery, MCP/tool schema issues, or troubleshooting auth/session failures.

> **ℹ️ For deep-dive explanations on the Antigravity quota pools vs Antigravity CLI quota pools, see the supplemental document: [google-antigravity-limits.md](./google-antigravity-limits.md).**
> **ℹ️ For guidelines on testing and verifying changes to the plugin, see the supplemental document: [plugin-testing.md](./plugin-testing.md).**

> **⚠️ Secondary path:** The primary provider is now `antigravity-manager` (Docker container, port 8045). The Google OAuth plugin path (`google/antigravity-*` models) is legacy/fallback. Account rotation is handled upstream by the manager container.

## Mental Model

```
OpenCode → opencode-antigravity-auth plugin (google/antigravity-* models)
  → account selection / token refresh / project context
  → request transformation (Antigravity or Antigravity CLI)
  → quota/rate-limit/error classification
  → retry, fallback, recovery, or final error
  → response transformation back to OpenCode

OpenCode → antigravity-manager (127.0.0.1:8045, all models)
  → manager handles account rotation internally
  → OpenCode sees standard OpenAI-compatible endpoint
```

## Config Paths

| Purpose | Path |
|---|---|
| OpenCode config | `~/.config/opencode/opencode.json` |
| Account storage | `~/.config/opencode/antigravity-accounts.json` |
| Plugin config | `~/.config/opencode/antigravity.json` |
| Debug logs | `~/.config/opencode/antigravity-logs/` |
| Plugin source | `~/arthityap/ocagvrotate/src/` |
| Plugin dist | `~/arthityap/ocagvrotate/dist/` |

## Current State

- **Accounts:** 6 accounts configured
- **Active index:** 2
- **Strategy:** `round-robin`
- **Primary provider:** `antigravity-manager` (Docker, port 8045)
- **Secondary provider:** `google` (plugin, OAuth path)

## Account Storage (v4)

`refreshToken` must be a **bare token** — no `|projectId|managedProjectId` segments. Do NOT store top-level `projectId` or `managedProjectId`. Project resolution uses `ANTIGRAVITY_DEFAULT_PROJECT_ID` (`rising-fact-p41fc`). User-supplied project IDs from OAuth flows are personal GCP projects that lack Cloud Code Assist API and cause 403/429 cascades.

```json
{
  "version": 4,
  "accounts": [{
    "email": "user@gmail.com",
    "refreshToken": "1//0g...",
    "enabled": true,
    "fingerprint": { "deviceId": "...", "sessionToken": "...", "userAgent": "...", "apiClient": "...", "clientMetadata": { "ideType": "ANTIGRAVITY", "platform": "MACOS", "pluginType": "GEMINI" }, "createdAt": 1710000000000 },
    "cachedQuota": { "gemini-3-flash": { "remainingFraction": 0.9, "resetTime": "2026-06-16T04:55Z" } },
    "rateLimitResetTimes": {}
  }],
  "activeIndex": 0,
  "activeIndexByFamily": { "claude": 0, "gemini": 0 }
}
```

Manual edit rules: Stop OpenCode first. Back up the file. Never paste tokens into chat. Preserve `rateLimitResetTimes`, `fingerprint`, `cachedQuota` unless intentionally resetting.

## Model Routing

**Primary path (antigravity-manager):** `antigravity-manager/gemini-3-flash`, `antigravity-manager/claude-sonnet-4-6`, etc.

**Legacy path (Google OAuth plugin):**
- **Antigravity models:** `google/antigravity-gemini-3-pro`, `google/antigravity-gemini-3.1-pro`, `google/antigravity-gemini-3-flash`, `google/antigravity-gemini-3.5-flash-low`, `google/antigravity-claude-sonnet-4-6`, `google/antigravity-claude-opus-4-6-thinking`
- **Antigravity CLI models:** `google/gemini-2.5-flash`, `google/gemini-2.5-pro`, `google/gemini-3-flash-preview`, `google/gemini-3-pro-preview`, `google/gemini-3.1-pro-preview`

Claude and image models always use Antigravity. Gemini models default to Antigravity unless `cli_first: true`.

## Key Config Knobs (`~/.config/opencode/antigravity.json`)

```json
{
  "account_selection_strategy": "round-robin",
  "switch_on_first_rate_limit": true,
  "pid_offset_enabled": false,
  "keep_thinking": false,
  "session_recovery": true,
  "cli_first": false,
  "debug": true,
  "debug_tui": true,
  "scheduling_mode": "cache_first",
  "max_cache_first_wait_seconds": 60,
  "failure_ttl_seconds": 3600,
  "soft_quota_threshold_percent": 90,
  "quota_refresh_interval_minutes": 15
}
```

| Option | Meaning |
|---|---|
| `account_selection_strategy` | `sticky`, `round-robin`, or `hybrid` |
| `switch_on_first_rate_limit` | Switch account immediately after first rate limit |
| `pid_offset_enabled` | Distribute sessions across accounts by process ID |
| `keep_thinking` | Preserve Claude thinking blocks (can reduce stability) |
| `session_recovery` | Recover from missing `tool_result` errors |
| `cli_first` | Prefer Antigravity CLI quota for Gemini models |
| `scheduling_mode` | `cache_first` — prefer cached quota data |
| `failure_ttl_seconds` | How long to remember account failures |
| `soft_quota_threshold_percent` | Threshold for soft quota warnings |

**Strategies:** 1 account → `sticky`. 2-3 → `hybrid`. 4+ → `round-robin`. Parallel agents → `round-robin` + `pid_offset_enabled`.

## Error Classification

| Symptom | Class | Action |
|---|---|---|
| `invalid_grant` | Revoked OAuth | Remove/re-authenticate |
| Missing access token | Auth failure | Refresh or re-authenticate |
| 403 `validation_required` | Google verification | Verify via login menu |
| 403 `API not enabled in project` + 429 cascade | User-supplied projectId is bad personal GCP project | Strip projectId from refresh tokens |
| 429 `QUOTA_EXHAUSTED` | Quota exhausted | Wait, rotate, or add accounts |
| 429 `RATE_LIMIT_EXCEEDED` | Short rate limit | Wait/backoff, retry or rotate |
| 503/529 `MODEL_CAPACITY_EXHAUSTED` | Server busy | Same-account retry; don't mark quota exhausted |
| 500 `SERVER_ERROR` | Server error | Retry; don't rotate unless persistent |
| 400 `INVALID_ARGUMENT` / `Unknown name "parameters"` | Tool schema issue | Schemas are scrubbed by `schema-cleaner.ts`; disable incompatible MCP servers |
| `tool_use` without `tool_result` | Interrupted tool | Recovery flow or `/undo` |
| All accounts rate-limited (all `ready`) | Active index stuck | Reset `activeIndex` and `activeIndexByFamily` |
| No HTTP requests in debug logs | Plugin stuck in selection loop | Reset `activeIndex`; check strategy config |
| `quotaUser=undefined` in debug | Vestigial field (never populated) | Cosmetic only, no functional impact |

## Diagnostic Workflow

1. **Check plugin/cache state** — stale cache/SemVer errors are plugin issues, not account issues
2. **Enable debug** — `"debug": true, "debug_tui": true` in `antigravity.json`, or `OPENCODE_ANTIGRAVITY_DEBUG=2`
3. **Classify the error** — use the table above
4. **Inspect account state** — `jq '.accounts[] | {email, enabled, rateLimitResetTimes, cachedQuota, coolingDownUntil, verificationRequired}' ~/.config/opencode/antigravity-accounts.json`
5. **Check quota** — `opencode auth login` → quota/account management
6. **Check MCP/schema** — disable MCP servers one by one; rename keys starting with numbers
7. **Reset only for auth revocation** — `rm ~/.config/opencode/antigravity-accounts.json && opencode auth login`

## Troubleshooting

### User-Supplied Project ID Rejection (403 + 429 Cascade)

**Symptom:** `403 Forbidden` — *"Gemini for Google Cloud API has not been used in project X"*, then `429` on fallback.

**Cause:** Refresh token contains `|projectId|` from a personal GCP project lacking Cloud Code Assist API.

**Diagnosis:**
```bash
jq '.accounts[] | {email, projectId, rt_segments: (.refreshToken | split("|") | length)}' ~/.config/opencode/antigravity-accounts.json
# rt_segments > 1 means embedded projectId — should be 1
```

**Fix:** Strip all project segments from refresh tokens (bare tokens only). Remove top-level `projectId`/`managedProjectId`. The plugin always uses `ANTIGRAVITY_DEFAULT_PROJECT_ID`.

### All Accounts Rate-Limited

1. Check per-model: `jq '.accounts[].cachedQuota' ~/.config/opencode/antigravity-accounts.json`
2. Wait for earliest reset; add accounts if needed
3. If all show "ready" but plugin says rate-limited: reset `activeIndex` to a healthy account
4. Verify `account_selection_strategy` is set in `antigravity.json`

### Sync from Antigravity Manager

1. Find account in `/home/yapilwsl/.antigravity_tools/accounts/{uuid}.json`
2. Copy `token.refresh_token` → `refreshToken` (strip any `|project|managedProject` suffix)
3. **Do NOT copy `token.project_id`**
4. Preserve existing `fingerprint` if present
5. Check for multiple files with same email — use newest `mtime`

## Plugin Development

```bash
# Build
cd ~/arthityap/ocagvrotate && npm run build

# Type check
npm run typecheck

# Test
npm test

# Single test file
npx vitest run src/plugin/auth.test.ts
```

Plugin loads from: `file:///home/yapilwsl/arthityap/ocagvrotate/dist/index.js`

## Safety Rules

- Never commit, paste, print, or expose refresh tokens
- Never add project-local copies of account credentials
- Never silently continue after auth failure
- Don't reimplement OAuth/fallback/signature internals in external scripts
- Don't rotate accounts for schema/tool/model `400` errors unless auth/quota symptoms also present
- Redact secrets in all responses
