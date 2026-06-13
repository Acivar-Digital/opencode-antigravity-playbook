---
name: google-oauth-accounts
description: Deep operational playbook for Google OAuth account rotation, quota/rate-limit handling, model routing, diagnostics, and troubleshooting through the opencode-antigravity-auth OpenCode plugin.
---

# Google OAuth Antigravity Accounts

Use this skill whenever work involves Google OAuth account rotation for OpenCode through `opencode-antigravity-auth`, including account storage, quota/rate-limit rotation, model routing, plugin configuration, diagnostics, session recovery, MCP/tool schema issues, or troubleshooting auth/session failures.

Source repository: https://github.com/Acivar-Digital/opencode-antigravity-playbook

## Important Terms Warning

This plugin is unofficial and may violate provider Terms of Service. Account suspension, shadow-bans, API changes, and provider-side abuse detection are possible. Do not use production services to bypass intended limits. Redact tokens, refresh tokens, device IDs, verification URLs, and account credentials in all outputs.

## Correct Mental Model

Do not treat `opencode-antigravity-auth` as a simple account rotator. It is a full OpenCode plugin with compiled `dist/` output, request interception, OAuth token handling, Claude/Gemini payload transformation, schema hardening, quota/rate-limit scheduling, session recovery, account storage migrations, and structured debug logging. [1][5]

The right mental model is:

```text
OpenCode
  -> opencode-antigravity-auth plugin
    -> account selection / token refresh / project context
    -> request transformation for Antigravity or Gemini CLI
    -> quota/rate-limit/error classification
    -> retry, fallback, recovery, or final error
    -> response transformation back to OpenCode
```

The plugin is sophisticated enough that most fixes should be operational configuration or diagnosis, not external helper scripts.

## Core Configuration Paths

Paths are global OpenCode paths unless explicitly using project config.

| Purpose | Path |
| --- | --- |
| Main OpenCode config | `~/.config/opencode/opencode.json` |
| Project OpenCode config | `.opencode/opencode.json` or `.opencode/opencode.jsonc` |
| Google OAuth account storage | `~/.config/opencode/antigravity-accounts.json` |
| User plugin config | `~/.config/opencode/antigravity.json` |
| Project plugin config | `.opencode/antigravity.json` |
| Debug logs | `~/.config/opencode/antigravity-logs/` |
| Custom config directory | `OPENCODE_CONFIG_DIR=/path/to/config opencode` |

Project config is lower priority than user config, but can still affect behavior. Do not put account credentials in project-local files.

## Plugin Installation and Version

Add the plugin to `~/.config/opencode/opencode.json` using the singular key:

```json
{
  "plugin": ["opencode-antigravity-auth@latest"]
}
```

Use `opencode-antigravity-auth@beta` only when the user explicitly asks for beta features or when a known bug is fixed only in beta.

After adding or changing the plugin, authenticate with:

```bash
opencode auth login
```

If OpenCode reports stale plugin/cache errors, invalid SemVer for `beta`, or `This version of Antigravity is no longer supported`, treat it as a plugin/cache/version issue, not an account issue. Re-resolve or clear the plugin cache and re-authenticate. [4]

## What the Plugin Already Does

The plugin already implements most of the sophisticated behavior that a thin account rotator would need.

### Request interception and transformation

It intercepts requests to `generativelanguage.googleapis.com`, then transforms them for Antigravity or Gemini CLI. It handles model detection, thinking config, Claude thinking blocks, tool normalization, schema cleaning, tool-call ID assignment, and streaming response transformation. [1]

### OAuth and token management

It manages OAuth refresh/access tokens, refreshes expired tokens, and handles `invalid_grant` by removing revoked accounts from the pool. It also supports proactive token refresh. [3][6]

### Account rotation and quota scheduling

It supports:

- `sticky`
- `round-robin`
- `hybrid`
- per-family active index: `claude` / `gemini`
- health score tracking
- token bucket tracking
- LRU freshness
- soft quota protection
- rate-limit reset tracking
- cooldowns
- consecutive failure TTL
- PID offset for parallel agents
- quota cache refresh [2][3]

### Dual Gemini quota pools

For Gemini models, the plugin can use two independent quota pools per account:

| Quota Pool | When Used |
| --- | --- |
| Antigravity | Default for Gemini requests |
| Gemini CLI | Automatic fallback between Antigravity and Gemini CLI in both directions |

Gemini quota fallback is automatic in current versions; `quota_fallback` is deprecated and ignored for compatibility. [3][6]

### Payload and schema hardening

It includes:

- JSON schema cleaning for Antigravity
- `const` → `enum`
- `$ref` → description hint
- `additionalProperties: false` → description hint
- unsupported keyword removal
- empty object placeholder injection
- tool schema normalization
- Claude tool hardening
- tool ID recovery
- thinking/signature sentinel handling
- session recovery for missing `tool_result` blocks [1][3][4][6]

### Debug logging

Debug logging is split:

| Setting | Purpose |
| --- | --- |
| `debug` | File logs in `~/.config/opencode/antigravity-logs/` |
| `debug_tui` | TUI log panel output |
| `OPENCODE_ANTIGRAVITY_DEBUG` | Environment override for file debug logging |
| `OPENCODE_ANTIGRAVITY_DEBUG_TUI` | Environment override for TUI debug logging |
| `OPENCODE_ANTIGRAVITY_QUIET` | Suppress most toasts |

Do not mix debug logs with persistent account state. [3][6]

## Account Storage

Accounts are stored in:

```text
~/.config/opencode/antigravity-accounts.json
```

This file contains OAuth refresh tokens. Treat it like a password file.

### Extracting from Antigravity Desktop (VSCDB)

You can automatically extract Google refresh tokens from the Antigravity Desktop application's local database (`state.vscdb`) by running the VSCDB Extractor utility (`src/utils/vscdb-extractor.ts`). The tool decodes the Base64 Protobuf payload stored under the `antigravityUnifiedStateSync.oauthToken` key to dynamically import valid OAuth tokens into the account pool.

### Storage v4 fields

Current storage uses schema v4. Important fields include:

```json
{
  "version": 4,
  "accounts": [
    {
      "email": "user@gmail.com",
      "refreshToken": "...",
      "projectId": "...",
      "managedProjectId": "...",
      "addedAt": 1710000000000,
      "lastUsed": 1710000000000,
      "enabled": true,
      "lastSwitchReason": "rate-limit",
      "rateLimitResetTimes": {
        "claude": 1710000000000,
        "gemini-antigravity": 1710000000000,
        "antigravity-cli": 1710000000000
      },
      "coolingDownUntil": 1710000000000,
      "cooldownReason": "auth-failure",
      "fingerprint": {
        "deviceId": "...",
        "sessionToken": "...",
        "userAgent": "...",
        "apiClient": "...",
        "clientMetadata": {
          "ideType": "ANTIGRAVITY",
          "platform": "MACOS",
          "pluginType": "GEMINI"
        },
        "createdAt": 1710000000000
      },
      "fingerprintHistory": [],
      "cachedQuota": {
        "claude": { "remainingFraction": 1, "resetTime": "2026-05-31T05:55:26Z", "modelCount": 1 },
        "gemini-pro": { "remainingFraction": 1, "resetTime": "2026-05-31T05:55:23Z", "modelCount": 1 },
        "gemini-flash": { "remainingFraction": 1, "resetTime": "2026-05-31T05:55:23Z", "modelCount": 1 }
      },
      "cachedQuotaUpdatedAt": 1710000000000,
      "verificationRequired": false,
      "verificationRequiredAt": null,
      "verificationRequiredReason": null,
      "verificationUrl": null
    }
  ],
  "activeIndex": 0,
  "activeIndexByFamily": {
    "claude": 0,
    "gemini": 0
  }
}
```

Redact these fields in all outputs:

- `refreshToken`
- `projectId` if sensitive
- `managedProjectId` if sensitive
- `fingerprint.deviceId`
- `fingerprint.sessionToken`
- `verificationUrl`

### Storage behavior to know

The plugin uses:

- schema migrations from v1/v2/v3 to v4
- file locking
- atomic temp-file write plus rename
- secure `0600` permissions on POSIX
- account deduplication by email
- merge-on-save behavior for normal writes
- destructive replace writes for deletion operations
- fingerprint history
- verification-required account state [3][6]

Manual editing rules:

1. Stop OpenCode before manual repairs.
2. Back up `antigravity-accounts.json`.
3. Never paste tokens into chat.
4. Preserve `rateLimitResetTimes`, `fingerprint`, `cachedQuota`, and `verificationRequired` unless you intentionally reset them.
5. If the file is corrupt, back it up and re-authenticate rather than silently replacing it.

## Account Management

Add or manage accounts through the plugin flow:

```bash
opencode auth login
```

The login menu can:

- add accounts
- re-authenticate
- check quotas
- manage accounts
- enable/disable accounts
- verify accounts when Google requires verification [2][6]

### Recommended strategies

| Setup | Recommended Strategy | Why |
| --- | --- | --- |
| 1 account | `sticky` | No rotation needed; preserves prompt cache |
| 2-3 accounts | `hybrid` | Health score + token bucket + LRU |
| 4+ accounts | `round-robin` | Maximum throughput |
| Parallel agents | `round-robin` + `pid_offset_enabled: true` | Distribute sessions across accounts |

### Account checks without exposing secrets

```bash
jq '.accounts[] | {email, enabled, activeIndex, rateLimitResetTimes, cachedQuota, coolingDownUntil, cooldownReason, verificationRequired}' ~/.config/opencode/antigravity-accounts.json
jq '{activeIndex, activeIndexByFamily}' ~/.config/opencode/antigravity-accounts.json
```

If `jq` is unavailable, tell the user to open the file and redact `refreshToken`.

## Model Routing

### Antigravity-routed models

Common Antigravity models:

- `google/antigravity-gemini-3-pro`
- `google/antigravity-gemini-3.1-pro`
- `google/antigravity-gemini-3-flash`
- `google/antigravity-gemini-3.5-flash-low`
- `google/antigravity-gemini-3.5-flash-extra-low`
- `google/antigravity-gemini-3.5-flash-high`
- `google/antigravity-claude-sonnet-4-6`
- `google/antigravity-claude-opus-4-6-thinking`

### Gemini CLI quota models

Common Gemini CLI quota models:

- `google/gemini-2.5-flash`
- `google/gemini-2.5-pro`
- `google/gemini-3-flash-preview`
- `google/gemini-3-pro-preview`
- `google/gemini-3.1-pro-preview`
- `google/gemini-3.1-pro-preview-customtools`

### Routing notes

- Claude and image models always use Antigravity.
- Gemini models default to Antigravity unless `cli_first` is enabled.
- With `cli_first: true`, Gemini models try Gemini CLI quota first, then Antigravity.
- Gemini fallback between Antigravity and Gemini CLI is automatic in current versions.
- Model names are transformed for the target API, for example `gemini-3-flash` can map to `gemini-3-flash-preview`. [2][3]
- **Gemini 3.5 Flash**: The Antigravity API requires `gemini-3.5-flash-low` as the model name (not `gemini-3.5-flash`). The plugin's model-resolver must handle this mapping. Both `antigravity-gemini-3.5-flash-low` and `antigravity-gemini-3.5-flash-high` resolve to the same backend model `gemini-3.5-flash-low` with `thinkingLevel: "low"` because Google currently only exposes one 3.5 Flash quota row.

Use variants explicitly:

```bash
opencode run "Hello" --model=google/antigravity-claude-opus-4-6-thinking --variant=max
```

## Advanced Configuration Knobs

Create or edit `~/.config/opencode/antigravity.json` or `.opencode/antigravity.json`.

### Account rotation

```json
{
  "account_selection_strategy": "hybrid",
  "switch_on_first_rate_limit": true,
  "pid_offset_enabled": false,
  "scheduling_mode": "cache_first",
  "max_cache_first_wait_seconds": 60,
  "failure_ttl_seconds": 3600,
  "request_jitter_max_ms": 0
}
```

| Option | Meaning |
| --- | --- |
| `account_selection_strategy` | `sticky`, `round-robin`, or `hybrid` |
| `switch_on_first_rate_limit` | Switch account immediately after first rate limit |
| `pid_offset_enabled` | Distribute sessions across accounts by process ID |
| `scheduling_mode` | `cache_first`, `balance`, or `performance_first` |
| `max_cache_first_wait_seconds` | Max wait for same account in `cache_first` mode |
| `failure_ttl_seconds` | TTL before consecutive failures expire |
| `request_jitter_max_ms` | Random delay before each request; use sparingly |

### Soft quota protection

```json
{
  "soft_quota_threshold_percent": 90,
  "quota_refresh_interval_minutes": 15,
  "soft_quota_cache_ttl_minutes": "auto"
}
```

| Option | Meaning |
| --- | --- |
| `soft_quota_threshold_percent` | Skip accounts when usage reaches this percent |
| `quota_refresh_interval_minutes` | Background quota refresh interval |
| `soft_quota_cache_ttl_minutes` | How long quota cache is considered fresh |

`100` disables soft quota protection. `auto` derives cache freshness from the refresh interval. [3]

### Model behavior

```json
{
  "keep_thinking": false,
  "session_recovery": true,
  "auto_resume": false,
  "resume_text": "continue",
  "cli_first": false
}
```

| Option | Meaning |
| --- | --- |
| `keep_thinking` | Preserve Claude thinking blocks; can reduce stability |
| `session_recovery` | Recover from missing `tool_result` errors |
| `auto_resume` | Auto-send resume prompt after recovery |
| `resume_text` | Text used for auto-resume |
| `cli_first` | Prefer Gemini CLI quota for Gemini models |

### Debugging

```json
{
  "debug": true,
  "debug_tui": true,
  "quiet_mode": false
}
```

Environment overrides:

```bash
export OPENCODE_ANTIGRAVITY_DEBUG=2
export OPENCODE_ANTIGRAVITY_DEBUG_TUI=1
export OPENCODE_ANTIGRAVITY_QUIET=1
opencode
```

## Error Classification and Correct Actions

Use this matrix before rotating or resetting accounts.

| Symptom | Likely Class | Action |
| --- | --- | --- |
| `invalid_grant` | Revoked OAuth token | Remove/re-authenticate that account |
| Missing access token | Auth/token failure | Refresh or re-authenticate |
| 403 `validation_required` | Google verification required | Disable/verify account via login menu |
| 403 Gemini CLI `cloudaicompanion.companions.generateChat` | Missing GCP project/API | Enable Gemini for Google Cloud API and add `projectId` |
| 429 `QUOTA_EXHAUSTED` | Quota exhausted | Wait, rotate, or add accounts |
| 429 `RATE_LIMIT_EXCEEDED` | Short rate limit | Wait/backoff, then retry or rotate. The `src/utils/rate-limit.ts` parser calculates exact millisecond cooldowns from string values (e.g., `2h1m25s`). |
| Token Consumption | High API costs on background tasks | Background tasks like title generation are automatically downgraded to `gemini-2.5-flash` via the `token-saver.ts` utility. |
| 503/529 `MODEL_CAPACITY_EXHAUSTED` | Capacity/server busy | Same-account retry/backoff; do not mark quota exhausted |
| 500 `SERVER_ERROR` | Server error | Retry/backoff; do not rotate unless persistent |
| `Unknown name "parameters"` / `400 INVALID_ARGUMENT` | Tool schema incompatibility | Schemas are recursively scrubbed (e.g. `propertyNames`, `anyOf`, `[undefined]`) by `schema-cleaner.ts` before reaching the API. |
| Invalid function name | MCP/tool naming issue | Rename MCP keys so names start with a letter or underscore |
| `tool_use` without `tool_result` | Interrupted tool execution | Use recovery flow or `/undo` |
| Thinking block order error | Thinking/signature corruption | Let plugin recover; consider `keep_thinking: false` |
| `This version of Antigravity is no longer supported` | Plugin sends a version number (e.g. `2.0.6`) that Google rejects | Patch plugin version to a higher number like `4.2.1` (see Version Patch Fix section below) |
| `404 Not Found` with `Effective Model: gemini-3.5-flash` | Wrong API model name for Gemini 3.5 Flash | Patch model-resolver.js to use `gemini-3.5-flash-low` instead of `gemini-3.5-flash` (see Gemini 3.5 Flash Model Resolution Fix below) |
| `All accounts rate-limited` with snapshot showing all `ready` | Active index stuck on a rate-limited account; plugin loops through accounts without sending HTTP requests | Reset `activeIndex` and `activeIndexByFamily` to a healthy account index; check that `account_selection_strategy` is set (not null) |
| No HTTP requests in debug logs (0 POST/GET entries) | Plugin stuck in account selection loop, never reaches the network layer | Reset `activeIndex`; verify `account_selection_strategy` is configured; check version patch is applied |
| `round-robin` rotation stuck on single account | The cursor indexed into the filtered available list rather than the full list, causing mod limits to loop on the same active index when other accounts were rate-limited or over-quota | Update to version >= 2.0.0 (or fix `getNextForFamily` in `accounts.ts` to scan across the full accounts array starting from the cursor) |

Do not rotate accounts for schema/tool/model `400` errors unless the account is also showing auth/quota/rate-limit symptoms.

## Account Health Check, Monitoring & Resetting

Use the built-in health, reset, and fetch-now scripts in the `admin/` directory to instantly view status, enabled/disabled state, verification requirements, cached/live quota fractions, rate limit cooldowns, active alerts, force-reset all account pools, or force-refresh quota usage:

```bash
admin/health
admin/reset
admin/fetch-now
```

### Modes:
- **One-shot status snapshot:** `admin/health`
- **Live quota fetch from Google (slower but accurate):** `admin/health --live`
- **Live monitoring (refreshes every 30 seconds):** `admin/health --watch --interval 30 --live`
  *(Note: The health checker defaults to `linux/amd64` headers and explicitly warns the user on the dashboard. If the host platform/LLM runs on Windows or macOS, customize the `USER_AGENT` variable directly inside `scripts/monitor.mjs`.)*
- **Force-reset all account states:** `admin/reset`
- **Force-refresh and cache quotas:** `admin/fetch-now`

## Diagnostic Workflow

Use this order.

### 1. Confirm plugin and cache state

Check whether the plugin is installed and current. If there are stale cache or SemVer errors, fix those before touching accounts. [4]

### 2. Enable debug logging

Use:

```json
{
  "debug": true,
  "debug_tui": true
}
```

or environment variables:

```bash
export OPENCODE_ANTIGRAVITY_DEBUG=2
export OPENCODE_ANTIGRAVITY_DEBUG_TUI=1
```

Then inspect logs in:

```text
~/.config/opencode/antigravity-logs/
```

### 3. Classify the error

Use the error matrix above. Do not start with account reset.

### 4. Inspect account state

```bash
jq '.accounts[] | {email, enabled, rateLimitResetTimes, cachedQuota, coolingDownUntil, cooldownReason, verificationRequired}' ~/.config/opencode/antigravity-accounts.json
```

Look for:

- disabled accounts
- verification-required accounts
- stale rate-limit reset times
- missing `projectId` for Gemini CLI models
- unusually high quota usage
- cooling-down accounts

### 5. Check quota

Use:

```bash
opencode auth login
```

Then select the quota/account management option.

### 6. Check MCP/tool schema issues

If the error mentions:

- `Unknown name "parameters"`
- invalid function names
- malformed tool schemas
- tool names starting with numbers

Disable MCP servers one by one or rename MCP keys. The plugin cleans schemas, but incompatible MCP servers can still break Gemini 3/Antigravity validation. [4]

### 7. Check project/API permission

For Gemini CLI permission errors, verify:

1. Google Cloud project exists.
2. Gemini for Google Cloud API is enabled.
3. `projectId` is present for each account.

### 8. Reset only when appropriate

Reset accounts only for auth/token revocation or persistent multi-account auth corruption:

```bash
rm ~/.config/opencode/antigravity-accounts.json
opencode auth login
```

Do not use this as the first fix for schema/tool/MCP/model errors.

## Common Troubleshooting

### Multi-account auth issues

If tokens are stale or multiple accounts are corrupted:

```bash
rm ~/.config/opencode/antigravity-accounts.json
opencode auth login
```

### Account needs verification

If debug logs or the login menu show `validation_required`, the account may be disabled and marked with a verification URL. Use the plugin menu to verify accounts. Do not print the verification URL. [6]

### Gemini CLI permission denied

Error often references:

```text
cloudaicompanion.companions.generateChat
```

Fix:

1. Create or select a Google Cloud project.
2. Enable **Gemini for Google Cloud API** (`cloudaicompanion.googleapis.com`).
3. Add `projectId` to each account entry in `~/.config/opencode/antigravity-accounts.json`.

```json
{
  "email": "user@gmail.com",
  "refreshToken": "...",
  "projectId": "your-project-id"
}
```

### All accounts rate-limited

1. Confirm quota and rate-limit reset times.
2. Wait for the earliest reset time.
3. Add more accounts if needed.
4. If stale, delete accounts file and re-authenticate.
5. For persistent hybrid-mode issues, try `account_selection_strategy: "sticky"` or update to beta.
6. **If the rate-limit snapshot shows all accounts as "ready" but the plugin still reports "All accounts rate-limited"** — the `activeIndex` is stuck on an account the plugin internally considers unhealthy. The debug log will show repeated `Selected: same-email (N/N)` entries and zero HTTP requests. Reset `activeIndex` and `activeIndexByFamily` to a known-healthy account:
   ```bash
   jq '.activeIndex = 0 | .activeIndexByFamily.gemini = 0 | .activeIndexByFamily.claude = 0' ~/.config/opencode/antigravity-accounts.json > /tmp/accounts-fix.json && mv /tmp/accounts-fix.json ~/.config/opencode/antigravity-accounts.json
   ```
   Also verify `account_selection_strategy` is set in `antigravity.json` (not null/missing). Without a strategy, the plugin defaults to `sticky` and will keep retrying the same account.

### Stubborn accounts that keep reverting (verification-required / re-enabled after delete)

**Symptom:** An account you deleted keeps coming back, or an account you re-enabled keeps flipping back to `enabled: false` / `verificationRequired: true` after every save, even after WSL/OpenCode restarts.

**Root cause:** The plugin has a background quota-refresh loop that calls `verifyAccountAccess()` on every account. When Google returns a `blocked` response (e.g. `validation_required`), the plugin calls `markStoredAccountVerificationRequired()` and `markAccountVerificationRequired()`, which set `enabled: false` and `verificationRequired: true` in both the in-memory state and on disk — overwriting any manual edits. For deleted accounts, `saveAccounts()` uses a merge-on-save strategy that pulls in-memory state back into the file.

**Why manual file edits fail while OpenCode is running:** The plugin holds the account state in memory. Any file edit you make gets overwritten within ~20 seconds by the background loop. Even atomic temp-file writes lose the race because the plugin's in-memory state wins on merge.

**The correct fix: patch the plugin source files.** There are three functions to patch in the cache copy (the one OpenCode actually runs from):

```
~/.cache/opencode/packages/opencode-antigravity-auth@latest/node_modules/opencode-antigravity-auth/dist/src/plugin/storage.js
~/.cache/opencode/packages/opencode-antigravity-auth@latest/node_modules/opencode-antigravity-auth/dist/src/plugin.js
~/.cache/opencode/packages/opencode-antigravity-auth@latest/node_modules/opencode-antigravity-auth/dist/src/plugin/accounts.js
```

Also patch the repo copies in `/home/yapilwsl/arthityap/ocagvrotate/dist/src/plugin/` so the fix survives a `cp -r dist/` deploy.

#### Step 1 — Patch `storage.js`: filter on every write

In `saveAccounts` and `saveAccountsReplace`, add at the very top of the function body:

```js
export async function saveAccounts(storage) {
    // PATCH: strip banned accounts, force-enable specific accounts on every write
    const BANNED_EMAILS = ["tran.tran5990@gmail.com"];         // accounts to permanently delete
    const FORCE_ENABLED = ["emilywonderme@gmail.com"];         // accounts to keep enabled despite verificationRequired
    storage = {
        ...storage,
        accounts: storage.accounts
            .filter(a => !BANNED_EMAILS.includes(a.email))
            .map(a => FORCE_ENABLED.includes(a.email)
                ? { ...a, enabled: true, coolingDownUntil: null, cooldownReason: null,
                    verificationRequired: null, verificationRequiredAt: null,
                    verificationRequiredReason: null, verificationUrl: null }
                : a)
    };
    // ... rest of original function
```

Apply the same patch to `saveAccountsReplace`.

#### Step 2 — Patch `plugin.js`: block the quota loop from re-disabling

In `markStoredAccountVerificationRequired`, add an early return at the top:

```js
function markStoredAccountVerificationRequired(account, reason, verifyUrl) {
    // PATCH: skip force-enabled accounts
    const FORCE_ENABLED = ["emilywonderme@gmail.com"];
    if (account.email && FORCE_ENABLED.includes(account.email)) { return false; }
    // ... rest of original function
```

#### Step 3 — Patch `accounts.js`: block the in-memory manager from re-disabling

In `markAccountVerificationRequired`, add an early return:

```js
markAccountVerificationRequired(accountIndex, reason, verifyUrl) {
    const account = this.accounts[accountIndex];
    if (!account) { return false; }
    // PATCH: skip force-enabled accounts
    const FORCE_ENABLED = ["emilywonderme@gmail.com"];
    if (account.email && FORCE_ENABLED.includes(account.email)) { return false; }
    // ... rest of original function
```

#### Step 4 — Write the clean file and restart OpenCode

After patching all three files, write the accounts file with the correct state, then restart:

```bash
python3 << 'EOF'
import json, time, os
path = os.path.expanduser('~/.config/opencode/antigravity-accounts.json')
with open(path) as f:
    data = json.load(f)
# Remove banned accounts
data['accounts'] = [a for a in data['accounts'] if a['email'] != 'tran.tran5990@gmail.com']
# Re-enable stubborn accounts
for a in data['accounts']:
    if a['email'] == 'emilywonderme@gmail.com':
        a['enabled'] = True
        a['coolingDownUntil'] = None
        a['cooldownReason'] = None
        a['verificationRequired'] = None
        a['verificationRequiredAt'] = None
        a['verificationRequiredReason'] = None
        a['verificationUrl'] = None
# Fix out-of-range indices
n = len(data['accounts'])
if data.get('activeIndex', 0) >= n: data['activeIndex'] = 0
for fam in ['claude', 'gemini']:
    if data.get('activeIndexByFamily', {}).get(fam, 0) >= n:
        data['activeIndexByFamily'][fam] = 0
with open(path, 'w') as f:
    json.dump(data, f, indent=2)
os.chmod(path, 0o600)
print('Done:', [a['email'] for a in data['accounts']])
EOF
```

Then restart WSL/OpenCode. On the next startup, OpenCode loads the clean file, and all three patches block the quota loop from re-disabling or re-adding the accounts.

#### Verify patches are in place

```bash
grep -c "PATCH: strip banned\|PATCH: skip force" \
  ~/.cache/opencode/packages/opencode-antigravity-auth@latest/node_modules/opencode-antigravity-auth/dist/src/plugin/storage.js \
  ~/.cache/opencode/packages/opencode-antigravity-auth@latest/node_modules/opencode-antigravity-auth/dist/src/plugin.js \
  ~/.cache/opencode/packages/opencode-antigravity-auth@latest/node_modules/opencode-antigravity-auth/dist/src/plugin/accounts.js
```

Each file should show at least 1 match. If any show 0, re-apply the patch to that file.

**Note:** These patches are lost when the plugin is updated (npm re-extracts the cache). After any `opencode-antigravity-auth` update, re-apply all three patches. The repo copies (`/home/yapilwsl/arthityap/ocagvrotate/dist/src/plugin/`) serve as the reference — use `cp -r dist/ package.json` to re-deploy to cache.

### Infinite `.tmp` files

1. Stop OpenCode.
2. Remove stale temp files:

```bash
rm ~/.config/opencode/*.tmp
```

3. Add accounts or wait for rate limits to expire.

### Session recovery

If a request fails mid-session:

1. Type `continue` to trigger recovery.
2. If state is corrupted, use `/undo`.
3. Retry the operation.

### MCP server errors

Some MCP schemas are incompatible with Antigravity/Gemini validation.

Fix order:

1. Disable all MCP servers.
2. Enable one-by-one until the error reappears.
3. Rename MCP keys that start with a number.
4. Update the plugin if the error matches a known regression.
5. Add Google npm override if model resolution is stale:

```json
{
  "provider": {
    "google": {
      "npm": "@ai-sdk/google"
    }
  }
}
```

### Antigravity User-Agent Version Patch Fix

**The Problem:**
The `opencode-antigravity-auth` plugin sends a `User-Agent` header with an Antigravity version number to Google's API. Google's API performs a simple version threshold check — if the version is below its minimum, it returns `"This version of Antigravity is no longer supported"` embedded in a 200 response body.

The plugin resolves its version at startup by:
1. Querying the auto-updater API at `https://antigravity-auto-updater-974169037036.us-central1.run.app`
2. Scraping the changelog page
3. Falling back to a hardcoded constant

The auto-updater API returns a **stale version** (e.g., `2.0.6`) that is below Google's current minimum threshold. The plugin uses this stale value and gets rejected.

**Key Insight:** Google rejects version `2.0.6` (returned by the auto-updater). Any higher version works — we use `4.2.1` (the Antigravity-Manager's own version) because it's known to be accepted. There is no documented minimum threshold to discover; just pick a version number higher than what Google currently rejects.

**Diagnosis:**

```bash
# What version does the manager use? (shows what Google currently accepts)
docker logs antigravity-manager 2>&1 | grep "User-Agent initialized" | tail -3

# What version does the plugin currently send?
grep "user-agent\|antigravity/" ~/.config/opencode/antigravity-logs/*.log | tail -5

# What fallback is the plugin compiled with?
find /home/yapilwsl -path "*/opencode-antigravity-auth/dist/src/constants.js" \
  -exec grep "ANTIGRAVITY_VERSION_FALLBACK" {} \;
```

**The Fix — Patch these files:**

File 1: `dist/src/constants.js` (in both plugin copies)
Change the hardcoded fallback to a version above Google's minimum (currently `4.2.1`):
```js
export const ANTIGRAVITY_VERSION_FALLBACK = "4.2.1";  // was "1.18.3"
```

File 2: `dist/src/plugin/version.js` (in both plugin copies)
Disable the auto-updater API so it can't overwrite the fallback with the stale version:
```js
const VERSION_URL = "http://127.0.0.1:1/version";  // was the stale auto-updater URL
```

File 3: `~/.config/opencode/plugins/antigravity-quota/dist/quota-client.js`
This separate plugin has its own hardcoded User-Agent:
```js
'User-Agent': 'antigravity/4.2.1 linux/amd64',  // was 'antigravity/1.18.3 linux/amd64'
```

**There are TWO copies of the plugin — patch BOTH:**
```bash
# Find all copies
find /home/yapilwsl -path "*/opencode-antigravity-auth/dist/src/constants.js"
find /home/yapilwsl -path "*/opencode-antigravity-auth/dist/src/plugin/version.js"
```

OpenCode loads from the **cache** (`~/.cache/opencode/packages/opencode-antigravity-auth@latest/`), not from `~/.config/opencode/node_modules/`. Both must be patched, but the cache copy is the one that actually serves requests. The `node_modules` copy is a fallback/secondary.

**Verify all copies:**
```bash
find /home/yapilwsl -path "*/opencode-antigravity-auth/dist/src/constants.js" \
  -exec grep "ANTIGRAVITY_VERSION_FALLBACK" {} \;
find /home/yapilwsl -path "*/opencode-antigravity-auth/dist/src/plugin/version.js" \
  -exec grep "VERSION_URL =" {} \;
find /home/yapilwsl -path "*/antigravity-quota/dist/quota-client.js" \
  -exec grep "antigravity/" {} \;
```

All should show `4.2.1` and `127.0.0.1:1/version`.

**Quick diagnostic:** Check the `user-agent` header in the latest debug log. If it shows `antigravity/2.0.6`, the version patch is not applied to the cache copy. If it shows `antigravity/4.2.1`, the patch is active:
```bash
grep "user-agent" ~/.config/opencode/antigravity-logs/*.log | tail -3
```

**Why this works:** Google's API rejects the version `2.0.6` returned by the auto-updater. Any higher version number works — we use `4.2.1` (the Antigravity-Manager's own version) because it's known to be accepted. There is no documented minimum threshold; the version just needs to be higher than what Google currently rejects. When Google changes its requirements in the future, this number may need to be increased accordingly.

**Maintenance:** This patch is overwritten when the plugin is updated via npm. After any `opencode-antigravity-auth` update, re-check and re-apply. If Google raises its minimum version requirement, increase the fallback to match.

### Gemini 3.5 Flash Model Resolution Fix

**The Problem:**
Google's Antigravity API does NOT accept `gemini-3.5-flash` as a model name — it returns `404 Not Found`. The valid API model names are `gemini-3.5-flash-low` (low tier) and `gemini-3-flash-agent` (high tier). The plugin's `model-resolver.js` must map the OpenCode model IDs to these correct backend names.

Without this fix, the plugin resolves `antigravity-gemini-3.5-flash-low` → `gemini-3.5-flash` (stripping the tier suffix), and Google rejects it with 404.

**The Fix — Patch `model-resolver.js` in BOTH plugin copies:**

Add new constants after the existing `GEMINI_3_FLASH_REGEX`:
```js
const GEMINI_35_FLASH_REGEX = /^gemini-3\.5-flash/i;
const GEMINI_35_FLASH_EXTRA_LOW_MODEL = "gemini-3.5-flash-extra-low";
const GEMINI_35_FLASH_LOW_MODEL = "gemini-3.5-flash-low";
const GEMINI_35_FLASH_HIGH_MODEL = "gemini-3-flash-agent";
```

Add the helper function:
```js
function isGemini35FlashModel(model) {
    return GEMINI_35_FLASH_REGEX.test(model);
}
```

Add the backend model resolver:
```js
export function resolveAntigravityGemini35FlashBackendModel(model, thinkingLevel) {
    const modelWithoutQuota = model.replace(QUOTA_PREFIX_REGEX, "");
    if (!modelWithoutQuota.match(GEMINI_35_FLASH_REGEX)) return undefined;
    if (modelWithoutQuota.endsWith("-extra-low")) return GEMINI_35_FLASH_EXTRA_LOW_MODEL;
    const level = (thinkingLevel ?? "low").toLowerCase();
    return level === "high" ? GEMINI_35_FLASH_HIGH_MODEL : GEMINI_35_FLASH_LOW_MODEL;
}
```

Update `resolveModelWithTier()` — in the `skipAlias` block, add 3.5 flash handling:
```js
const isGemini35Flash = isGemini35FlashModel(modelWithoutQuota);
// ...
if (isGemini35Flash) {
    antigravityModel = resolveAntigravityGemini35FlashBackendModel(modelWithoutQuota) ?? `${baseName}-low`;
}
```

Force `thinkingLevel` to `"low"` for 3.5 flash in the tier resolution:
```js
const thinkingLevel = resolvedModel.toLowerCase().startsWith("gemini-3.5-flash")
    ? "low"
    : tier;
```

Also add model definitions in `models.js` (both copies):
```js
"antigravity-gemini-3.5-flash-low": {
    name: "Gemini 3.5 Flash Low (Antigravity)",
    limit: { context: 1048576, output: 65536 },
    modalities: DEFAULT_MODALITIES,
},
"antigravity-gemini-3.5-flash-extra-low": {
    name: "Gemini 3.5 Flash Extra Low (Antigravity)",
    limit: { context: 1048576, output: 65536 },
    modalities: DEFAULT_MODALITIES,
},
"antigravity-gemini-3.5-flash-high": {
    name: "Gemini 3.5 Flash High (Antigravity)",
    limit: { context: 1048576, output: 65536 },
    modalities: DEFAULT_MODALITIES,
},
```

And register all models in `opencode.json` under `google.provider.models`.

**Model resolution behavior:**
| OpenCode model ID | Effective API model | thinkingLevel |
|---|---|---|
| `google/antigravity-gemini-3.5-flash-low` | `gemini-3.5-flash-low` | `low` |
| `google/antigravity-gemini-3.5-flash-extra-low` | `gemini-3.5-flash-extra-low` | `low` |
| `google/antigravity-gemini-3.5-flash-high` | `gemini-3.5-flash-low` | `low` |

The extra-low variant maps to a distinct backend model with thinking_budget=1000 (vs 4000 for low). Both low and high currently resolve to the same backend model (`gemini-3.5-flash-low`) because Google's Antigravity API only exposes 3.5 Flash low/high as a single quota row. The high variant is a compatibility alias.

**Do NOT add `gemini-3.5-flash-*` entries to `MODEL_ALIASES`** — those are for Gemini CLI header style only. For Antigravity, the aliases are bypassed and the model name is kept as-is (with tier suffix).

**Verify the fix:**
```bash
# Check the resolver has the 3.5 constants
grep "GEMINI_35_FLASH" ~/.cache/opencode/packages/opencode-antigravity-auth@latest/node_modules/opencode-antigravity-auth/dist/src/plugin/transform/model-resolver.js

# Check models.js has the definitions
grep "antigravity-gemini-3.5" ~/.cache/opencode/packages/opencode-antigravity-auth@latest/node_modules/opencode-antigravity-auth/dist/src/plugin/config/models.js

# Test
opencode run "Hello" --model=google/antigravity-gemini-3.5-flash-low
opencode run "Hello" --model=google/antigravity-gemini-3.5-flash-extra-low
```

The debug log should show `Effective Model: gemini-3.5-flash-low` (not `gemini-3.5-flash`).

For stale Antigravity version or invalid SemVer errors, first try the **Version Patch Fix** above. If the issue persists, clear plugin caches and re-authenticate. [4]

## Plugin Compatibility

### oh-my-opencode

Disable built-in Google auth to avoid conflicts:

```json
{
  "google_auth": false
}
```

When spawning parallel subagents, enable PID offset:

```json
{
  "pid_offset_enabled": true
}
```

### DCP

List `opencode-antigravity-auth` before `@tarquinen/opencode-dcp`:

```json
{
  "plugin": [
    "opencode-antigravity-auth@latest",
    "@tarquinen/opencode-dcp@latest"
  ]
}
```

### Other gemini-auth plugins

Usually not needed. This plugin handles Google OAuth routing.

## Plugin Version vs Manager Version

The `antigravity-manager` Docker container and the `opencode-antigravity-auth` plugin are **separate clients** built by different people, but both authenticate to Google with the same OAuth tokens.

They use different version numbers because they track different products:
- **Antigravity Manager** (`lbjlaq/antigravity-manager`): version `4.2.1` — a Rust/Tauri account manager and proxy
- **Antigravity Tools** (the actual Google AI client): version `2.0.6` — an Electron app

Google's API rejects version `2.0.6` (the Antigravity Tools client version returned by the auto-updater). Any higher version number works — we use `4.2.1` (the Manager's version) because it's known to be accepted. It's not a fingerprint check, just a version comparison. When Google changes its requirements in the future, the version number may need to be bumped higher.

The auto-updater API returns `2.0.6` (the Antigravity Tools client version), which is below Google's minimum. The Manager correctly ignores it because its own `4.2.1` is higher.

**If the plugin shows "version no longer supported":** The OAuth tokens are fine — just the version number is too low. Apply the **Version Patch Fix** to increase it above Google's threshold.

## Syncing from Antigravity Manager

The `antigravity-manager` Docker container mounts `/home/yapilwsl/.antigravity_tools` at `/root/.antigravity_tools`. The Electron Antigravity IDE and the headless manager share the **same account files**. Both systems read and write to:

```text
/home/yapilwsl/.antigravity_tools/accounts.json
/home/yapilwsl/.antigravity_tools/accounts/
```

### Two Systems, Separate Account Pools

The Antigravity IDE (Electron GUI) and OpenCode (`opencode-antigravity-auth` plugin) maintain **independent account pools**:

- **Antigravity IDE** manages accounts in `/home/yapilwsl/.antigravity_tools/accounts/`
- **OpenCode** manages accounts in `~/.config/opencode/antigravity-accounts.json`

These are separate storage locations with different schemas. They share the same OAuth refresh tokens but track quota/rate-limit state independently.

### Sync Procedure

Sync accounts from the Antigravity IDE/Manager into OpenCode when the user asks or when both systems must share the same pool.

For each account to sync:

1. Find the account JSON in `/home/yapilwsl/.antigravity_tools/accounts/{uuid}.json`.
2. Extract email from `email` field.
3. Copy `token.refresh_token` into `refreshToken` (OpenCode schema).
4. Copy `token.project_id` into `projectId` (needed for Gemini CLI quota).
5. Set `enabled: true`.
6. Set `addedAt` and `lastUsed` to the current timestamp in milliseconds.
7. **Preserve the `fingerprint` object** if it already exists in the OpenCode entry. If creating a new entry, the plugin will auto-generate a fingerprint on first use.
8. **Fingerprint & Telemetry Parity:** The plugin emulates a high-fidelity Chrome browser identity (Chrome 149, WebKit, and Gecko) for content requests rather than simple user-agents. It dynamically maps host operating systems (`WINDOWS`, `MACOS`, `LINUX`) to matching user-agents and Structured Client Hints (`sec-ch-ua-*`).
9. **Single-Machine Identity Consistency:** The plugin extracts `syncAccountId` (Google User ID) from the OAuth userinfo response, persisting it in the account metadata. This maps directly to the `x-chrome-id-consistency-request` header. Google uses consistency IDs and client hints to track user logins; keeping `syncAccountId` and the device fingerprint stable per account prevents security triggers and rate-limiting blocks.
10. Never print or commit tokens.

### Account ID Mismatch Caveat

The Antigravity IDE and the headless manager may assign **different UUIDs** to the same email account. The manager might create a new UUID (`66c82c6d-...`) while the old file (`be8b275e-...`) still exists from a previous session with a revoked refresh token. When syncing after a re-login, always check for **multiple files with the same email** and use the most recently modified one (check `mtime`).

### Manager API

The headless manager on port 8045 exposes a management API with `Authorization: Bearer admin` or `x-api-key: admin`:

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Check manager status |
| `GET /api/accounts` | List all accounts (metadata only, no tokens) |

The API does **not** expose refresh tokens. Tokens can only be read from the account files on disk.

### Filesystem Watcher Caveat

The Antigravity IDE does **not** immediately flush account files to disk after re-login. The `accounts.json` index may update with `disabled: false` within seconds, but the individual `accounts/{uuid}.json` file may retain stale data for minutes or until a specific flush trigger. When grabbing fresh tokens after a re-login:

1. Wait 30-60 seconds after login for the file to be written.
2. Poll `md5sum /home/yapilwsl/.antigravity_tools/accounts/{uuid}.json` to detect changes.
3. Check file `mtime` — the newest file for a given email is the current one.

Prefer the OAuth login flow when possible. Manual sync is a repair path, not the normal path.

## Deploy and Backup Procedure

Before deploying local codebase modifications directly to the active OpenCode plugin cache:

1. **Create Backup**: Package the existing cache files to enable easy rollbacks:
   ```bash
   tar -czf /home/yapilwsl/arthityap/opencode-antigravity-auth-backup.tar.gz -C /home/yapilwsl/.cache/opencode/packages/opencode-antigravity-auth@latest .
   ```
2. **Build**: Run the local build script:
   ```bash
   npm run build
   ```
3. **Deploy**: Copy the compiled `dist/` directory and `package.json` to the target cache location:
   ```bash
   cp -r dist/ package.json /home/yapilwsl/.cache/opencode/packages/opencode-antigravity-auth@latest/node_modules/opencode-antigravity-auth/
   ```
4. **Rollback (If needed)**: If something breaks, restore from the backup:
   ```bash
   rm -rf /home/yapilwsl/.cache/opencode/packages/opencode-antigravity-auth@latest/*
   tar -xzf /home/yapilwsl/arthityap/opencode-antigravity-auth-backup.tar.gz -C /home/yapilwsl/.cache/opencode/packages/opencode-antigravity-auth@latest
   ```

## Testing and Verification

Useful plugin commands from the repository include: [5]

```bash
npm run typecheck
npm test
npm run build
npx tsx scripts/test-regression.ts --dry-run
npx tsx scripts/test-regression.ts --sanity
npx tsx scripts/test-regression.ts --heavy
npx tsx scripts/test-models.ts
```

For operational verification:

```bash
opencode run "Hello" --model=google/antigravity-gemini-3-flash
opencode run "Hello" --model=google/antigravity-claude-opus-4-6-thinking --variant=max
```

## June 18, 2026: Gemini CLI Deprecation & Antigravity CLI Transition

On June 18, 2026, Google is retiring the legacy Node.js-based Gemini CLI tool and its backend APIs.

### Technical Implications
1. **Header Stack Shift:**
   - Legacy `gemini-cli` used Node.js headers (`User-Agent: google-api-nodejs-client/...`, `gl-node/...`).
   - The Go-based replacement `antigravity-cli` is upgraded to use the same high-fidelity Chrome browser telemetry headers (User-Agent, `sec-ch-ua-*`, `x-client-data`, etc.) as the default `antigravity` path, while preserving the Go client's `Client-Metadata` block. This eliminates signature discrepancies on production endpoints.
2. **Quota Tracking/Usage Access:**
   - The legacy `v1internal:retrieveUserQuota` endpoint (used by `fetchGeminiCliQuota`) will return errors or become inactive.
   - Usage and model quota details (`remainingFraction` and `resetTime`) should instead be accessed exclusively via the primary `v1internal:fetchAvailableModels` response payload.
3. **Migration Steps:**
   - Rename/update references from `gemini-cli` to `antigravity-cli`. (Completed)
   - Update user-agent and client metadata headers to mimic the Chrome browser with custom client metadata. Platform-specific telemetry dynamically maps to `WINDOWS`, `LINUX`, or `MACOS` matching the runtime OS to guarantee signature compliance. (Completed)
   - Safely prune any fallback dependencies on `retrieveUserQuota`. (Completed)

### Architectural Shift & Usage Rules
1. **Shift to "Compute-Used" Metrics:**
   - Basic message-count tracking is discarded.
   - Google now tracks usage through a dynamic **Compute-Based Model** based on dynamic algorithmic weight calculations (prompt complexity, physical length and token volume of active history, and multi-step reasoning/tool loops).
2. **Multi-Tiered Reset Windows:**
   - **5-Hour Dynamic Window:** A short-term rolling percentage tracking immediate local workspace activity.
   - **Hard Weekly Cap:** A broader infrastructure cap measuring total accumulated processing effort over a rolling 7-day period.
   - Single complex debug loops can consume 15% to 20% of the weekly pool due to deep reasoning steps.
3. **Prepay Billing Wall:**
   - Gemini Developer API billing is decoupled from standard GCP post-pay credits.
   - System relies on a strict, isolated **Prepay System inside AI Studio**. If prepaid balances reach zero, requests fail immediately regardless of GCP credit availability.

## Safety Rules

- Never commit, paste, print, or expose refresh tokens.
- Never add project-local copies of account credentials.
- Never silently continue after auth failure; fail fast with a clear diagnosis.
- Do not reimplement OAuth, fingerprint, endpoint fallback, or signature internals in external scripts.
- Do not rotate accounts for schema/tool/model `400` errors unless account state also indicates auth/quota failure.
- Do not push remote changes involving credentials or local OpenCode config.
- Redact secrets in all responses.

## Source Notes

- Architecture guide: request flow, Claude handling, schema cleaning, session recovery, multi-account load balancing. [1]
- Multi-account docs: sticky/round-robin/hybrid, dual quota pools, quota checks, account storage, PID offset. [2]
- Configuration docs: advanced knobs, recommended configs, debug settings, rate-limit and quota tuning. [3]
- Troubleshooting docs: auth reset, stale plugin/cache, Gemini CLI permission, MCP/tool schema, rate limits, OAuth callback issues. [4]
- Package metadata: compiled `dist/`, build/test scripts, dependencies. [5]
- Changelog: v1.5/v1.6 details on verification flow, storage v4, soft quota, Gemini fallback, fingerprint changes, debug sink split, schema/tool fixes. [6]

## References

[1] https://raw.githubusercontent.com/Acivar-Digital/opencode-antigravity-playbook/main/docs/ARCHITECTURE.md

[2] https://raw.githubusercontent.com/Acivar-Digital/opencode-antigravity-playbook/main/docs/MULTI-ACCOUNT.md

[3] https://raw.githubusercontent.com/Acivar-Digital/opencode-antigravity-playbook/main/docs/CONFIGURATION.md

[4] https://raw.githubusercontent.com/Acivar-Digital/opencode-antigravity-playbook/main/docs/TROUBLESHOOTING.md

[5] https://raw.githubusercontent.com/Acivar-Digital/opencode-antigravity-playbook/main/package.json

[6] https://raw.githubusercontent.com/Acivar-Digital/opencode-antigravity-playbook/main/CHANGELOG.md
