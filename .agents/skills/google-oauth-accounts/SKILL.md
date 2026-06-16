---
name: google-oauth-accounts
description: Deep operational playbook for Google OAuth account rotation, quota/rate-limit handling, model routing, diagnostics, and troubleshooting through the opencode-antigravity-auth OpenCode plugin.
---

# Google OAuth Antigravity Accounts

Use this skill for Google OAuth account rotation, quota/rate-limit rotation, model routing, plugin configuration, diagnostics, session recovery, MCP/tool schema issues, or troubleshooting auth/session failures.

Source: https://github.com/Acivar-Digital/opencode-antigravity-playbook

## Mental Model

```
OpenCode → opencode-antigravity-auth plugin
  → account selection / token refresh / project context
  → request transformation (Antigravity or Antigravity CLI)
  → quota/rate-limit/error classification
  → retry, fallback, recovery, or final error
  → response transformation back to OpenCode
```

## Config Paths

| Purpose | Path |
|---|---|
| OpenCode config | `~/.config/opencode/opencode.json` |
| Account storage | `~/.config/opencode/antigravity-accounts.json` |
| Plugin config | `~/.config/opencode/antigravity.json` |
| Debug logs | `~/.config/opencode/antigravity-logs/` |

## Account Storage (v4)

`refreshToken` must be a **bare token** — no `|projectId|managedProjectId` segments. Do NOT store top-level `projectId` or `managedProjectId`. Project resolution is handled by Google's API via `ANTIGRAVITY_DEFAULT_PROJECT_ID` (`rising-fact-p41fc`). User-supplied project IDs from OAuth flows are personal GCP projects that lack Cloud Code Assist API and cause 403/429 cascades.

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

- **Antigravity models:** `google/antigravity-gemini-3-pro`, `google/antigravity-gemini-3.1-pro`, `google/antigravity-gemini-3-flash`, `google/antigravity-gemini-3.5-flash-low`, `google/antigravity-claude-sonnet-4-6`, `google/antigravity-claude-opus-4-6-thinking`
- **Antigravity CLI models:** `google/gemini-2.5-flash`, `google/gemini-3-flash-preview`, `google/gemini-3.1-pro-preview`
- Claude and image models always use Antigravity. Gemini models default to Antigravity unless `cli_first: true`.
- **Gemini 3.5 Flash:** API requires `gemini-3.5-flash-low` (not `gemini-3.5-flash`). The plugin's model-resolver handles this.

## Key Config Knobs (`~/.config/opencode/antigravity.json`)

```json
{
  "account_selection_strategy": "hybrid",
  "switch_on_first_rate_limit": true,
  "pid_offset_enabled": false,
  "keep_thinking": false,
  "session_recovery": true,
  "cli_first": false,
  "debug": true,
  "debug_tui": true
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

**Strategies:** 1 account → `sticky`. 2-3 → `hybrid`. 4+ → `round-robin`. Parallel agents → `round-robin` + `pid_offset_enabled`.

## Error Classification

| Symptom | Class | Action |
|---|---|---|
| `invalid_grant` | Revoked OAuth | Remove/re-authenticate |
| Missing access token | Auth failure | Refresh or re-authenticate |
| 403 `validation_required` | Google verification | Verify via login menu |
| 403 `API not enabled in project` + 429 cascade | User-supplied projectId is bad personal GCP project | Strip projectId from refresh tokens. See "User-Supplied Project ID Rejection" |
| 429 `QUOTA_EXHAUSTED` | Quota exhausted | Wait, rotate, or add accounts |
| 429 `RATE_LIMIT_EXCEEDED` | Short rate limit | Wait/backoff, retry or rotate |
| 503/529 `MODEL_CAPACITY_EXHAUSTED` | Server busy | Same-account retry; don't mark quota exhausted |
| 500 `SERVER_ERROR` | Server error | Retry; don't rotate unless persistent |
| 400 `INVALID_ARGUMENT` / `Unknown name "parameters"` | Tool schema issue | Schemas are scrubbed by `schema-cleaner.ts`; disable incompatible MCP servers |
| `tool_use` without `tool_result` | Interrupted tool | Recovery flow or `/undo` |
| `This version of Antigravity is no longer supported` | Stale auto-updater version | Patch `ANTIGRAVITY_VERSION_FALLBACK` to `4.2.1` in `constants.js`, disable auto-updater URL in `version.js` |
| `404 Not Found` with `gemini-3.5-flash` | Wrong model name | Patch model-resolver to use `gemini-3.5-flash-low` |
| All accounts rate-limited (all `ready`) | Active index stuck | Reset `activeIndex` and `activeIndexByFamily`; verify `account_selection_strategy` is set |
| No HTTP requests in debug logs | Plugin stuck in selection loop | Reset `activeIndex`; check strategy config; check version patch |
| `quotaUser=undefined` in debug | Vestigial field (never populated) | Cosmetic only, no functional impact |

## Diagnostic Workflow

1. **Check plugin/cache state** — stale cache/SemVer errors are plugin issues, not account issues
2. **Enable debug** — `"debug": true, "debug_tui": true` in `antigravity.json`, or `OPENCODE_ANTIGRAVITY_DEBUG=2`
3. **Classify the error** — use the table above
4. **Inspect account state** — `jq '.accounts[] | {email, enabled, rateLimitResetTimes, cachedQuota, coolingDownUntil, verificationRequired}' ~/.config/opencode/antigravity-accounts.json`
5. **Check quota** — `opencode auth login` → quota/account management
6. **Check MCP/schema** — disable MCP servers one by one; rename keys starting with numbers
7. **Check project/API** — see "User-Supplied Project ID Rejection" below
8. **Reset only for auth revocation** — `rm ~/.config/opencode/antigravity-accounts.json && opencode auth login`

## Troubleshooting

### User-Supplied Project ID Rejection (403 + 429 Cascade)

**Symptom:** `403 Forbidden` — *"Gemini for Google Cloud API has not been used in project X"*, then `429` on fallback, then `403` on prod. Debug shows non-Google project name.

**Cause:** Refresh token contains `|projectId|` from a personal GCP project lacking Cloud Code Assist API.

**Diagnosis:**
```bash
jq '.accounts[] | {email, projectId, rt_segments: (.refreshToken | split("|") | length)}' ~/.config/opencode/antigravity-accounts.json
# rt_segments > 1 means embedded projectId — should be 1
```

**Fix:** Strip all project segments from refresh tokens (bare tokens only). Remove top-level `projectId`/`managedProjectId`. The plugin's `ensureProjectContext()` always uses `ANTIGRAVITY_DEFAULT_PROJECT_ID` and never trusts user-supplied IDs.

### Version Patch Fix ("version no longer supported")

Google rejects the auto-updater's stale version (`2.0.6`). Patch both plugin copies (cache + node_modules):
1. `dist/src/constants.js`: `ANTIGRAVITY_VERSION_FALLBACK = "4.2.1"`
2. `dist/src/plugin/version.js`: `VERSION_URL = "http://127.0.0.1:1/version"`
3. `~/.config/opencode/plugins/antigravity-quota/dist/quota-client.js`: `'User-Agent': 'antigravity/4.2.1 linux/amd64'`

Verify: `grep "ANTIGRAVITY_VERSION_FALLBACK" ~/.cache/opencode/packages/opencode-antigravity-auth@latest/node_modules/opencode-antigravity-auth/dist/src/constants.js`

### Stubborn Accounts (verification-required loop)

Background quota-refresh loop re-disables accounts. Patch 3 files in cache copy:
- `storage.js`: Add `BANNED_EMAILS` filter + `FORCE_ENABLED` override at top of `saveAccounts` and `saveAccountsReplace`
- `plugin.js`: Early return in `markStoredAccountVerificationRequired` for force-enabled emails
- `accounts.js`: Early return in `markAccountVerificationRequired` for force-enabled emails

### All Accounts Rate-Limited

1. Check per-model: `jq '.accounts[].cachedQuota' ~/.config/opencode/antigravity-accounts.json`
2. Wait for earliest reset; add accounts if needed
3. If all show "ready" but plugin says rate-limited: reset `activeIndex` to a healthy account
4. Verify `account_selection_strategy` is set in `antigravity.json`

### VPS Auth Mismatch

Sync `auth.json` from local machine. Google section must have `"type": "oauth"` with NO `"key"` field.

### Sync from Antigravity Manager

1. Find account in `/home/yapilwsl/.antigravity_tools/accounts/{uuid}.json`
2. Copy `token.refresh_token` → `refreshToken` (strip any `|project|managedProject` suffix)
3. **Do NOT copy `token.project_id`**
4. Preserve existing `fingerprint` if present
5. Check for multiple files with same email — use newest `mtime`

### Deploy & Backup

```bash
# Backup
tar -czf /home/yapilwsl/arthityap/opencode-antigravity-auth-backup.tar.gz -C /home/yapilwsl/.cache/opencode/packages/opencode-antigravity-auth@latest .
# Build & deploy
npm run build
cp -r dist/ package.json ~/.cache/opencode/packages/opencode-antigravity-auth@latest/node_modules/opencode-antigravity-auth/
# Rollback
rm -rf ~/.cache/opencode/packages/opencode-antigravity-auth@latest/*
tar -xzf /home/yapilwsl/arthityap/opencode-antigravity-auth-backup.tar.gz -C ~/.cache/opencode/packages/opencode-antigravity-auth@latest
```

## Safety Rules

- Never commit, paste, print, or expose refresh tokens
- Never add project-local copies of account credentials
- Never silently continue after auth failure
- Don't reimplement OAuth/fallback/signature internals in external scripts
- Don't rotate accounts for schema/tool/model `400` errors unless auth/quota symptoms also present
- Redact secrets in all responses
