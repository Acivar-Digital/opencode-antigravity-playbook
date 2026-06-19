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

---

## June 19, 2026 — Post-Sandbox Shutdown Cleanup

### Removed: `ANTIGRAVITY_API_SPEC.md`
**Why removed:** Listed sandbox endpoints (`daily-cloudcode-pa.sandbox.googleapis.com`, `autopush-cloudcode-pa.sandbox.googleapis.com`) as "Active" — both were shut down on June 18, 2026. The endpoint table was dangerously misleading. The v1internal API format is still correct but the endpoint list was wrong. Key content preserved below.

**What we tried:** Updating the endpoint table to mark sandbox as dead and prod as primary. But the doc is 634 lines of reverse-engineered API spec that's now stale in multiple places (auth flow, header formats, model routing). Not worth maintaining — the source code is the authoritative spec.

**Key preserved content:**
- API actions: `/v1internal:generateContent`, `/v1internal:streamGenerateContent?alt=sse`, `/v1internal:loadCodeAssist`, `/v1internal:onboardUser`
- Request body format: `{project, model, request: {...}, userAgent, requestType, requestId}`
- Response format: `{response: {candidates: [...]}}` wrapper (unwrapped by streaming transformer)
- Only valid endpoint: `https://cloudcode-pa.googleapis.com`

### Removed: `STREAMING-ANALYSIS.md`
**Why removed:** One-time fix documentation for a streaming SSE wrapper bug that was resolved. The fix (unwrapping `{"response": ...}` in SSE lines) is now in `src/plugin/core/streaming/transformer.ts` and has been stable for months. No ongoing value.

**What we tried:** Keeping it as reference. But it's 172 lines documenting a single bug fix — the code and tests are the reference.

### Removed: `implement-codebase.md`
**Why removed:** Documents local codebase indexing setup via `opencode-codebase-index` plugin and `mcpmart` gateway. This is infrastructure config, not plugin documentation. Belongs in `~/.config/opencode/skills/setup-codebase-indexing/SKILL.md` where it already exists.

### Removed: `implement-weekly-count.md`
**Why removed:** Implementation plan for compute-based quota tracking (June 18, 2026 compute quota model). This was a planning doc — the implementation is complete in `src/plugin/compute.ts`, `src/plugin/quota.ts`, `src/plugin/storage.ts`, `src/plugin/rotation.ts`. The plan doc is obsolete.

### What We Tried & Failed: Google API Fallback
**Attempt:** Added `generativelanguage.googleapis.com` as a secondary fallback endpoint with `/v1beta/models/{model}:{action}` URL format. The idea was that if `cloudcode-pa.googleapis.com` went down, we could fall back to the standard Gemini API.

**Why it failed:** The plugin's request body is always wrapped as `{project, model, request: {...}, userAgent, requestType, requestId}` — the v1internal format. The Google API endpoint expects flat Gemini format (`{contents: [...], generationConfig: {...}}`). The URL was correct but the body was incompatible. Making it work would require a parallel body transformation path — too much complexity for a fallback that may never be needed.

**Lesson:** Fallbacks that aren't end-to-end tested are dead code. If `cloudcode-pa.googleapis.com` goes down, no fallback in this plugin will help — we'd need Google to provide a new endpoint. The Antigravity Manager has the same limitation (it also only speaks v1internal).

### What We Tried & Failed: Sandbox Endpoint Fallbacks
**Attempt:** Kept `daily-cloudcode-pa.sandbox.googleapis.com` and `autopush-cloudcode-pa.sandbox.googleapis.com` in the fallback list after the June 18 shutdown, hoping they might come back or that the timeout would be harmless.

**Why it failed:** Dead endpoints caused 20-40s timeouts per request. Combined with the `while(true)` retry loop in `plugin.ts`, this created an infinite retry storm — 412 POST requests in 6 minutes with zero responses. This likely triggered Google's anti-abuse detection and caused the `yapfrandb@gmail.com` Pro account loss.

**Lesson:** Never keep dead endpoints in fallback lists. They don't "fail gracefully" — they cause cascading failures. Remove them immediately when confirmed dead.

### What We Tried & Failed: 412 Retry Handling
**Attempt:** Added 412 (Precondition Failed) to `shouldRetryEndpoint` so it would move to the next endpoint instead of returning a failed response.

**Why it was wrong:** With a single endpoint, retrying 412 is pointless — it will just fail again. 412 should fail loudly so the user knows something is wrong. The real fix was removing the dead endpoints that caused 412 in the first place.

**Lesson:** Don't add retry logic for status codes you don't understand. Fix the root cause (dead endpoints) instead of papering over symptoms (retry loops).
# Graveyard

This file contains deprecated components, legacy tools, and obsolete instructions that have been removed from the active architecture.

---

## Antigravity Manager (Docker Container)
*Removed: June 2026*
*Reason: The local OpenCode `opencode-antigravity-auth` plugin was fixed to properly bypass WAF limitations via correct device fingerprinting, rendering the upstream Docker proxy redundant.*

Headless Docker container that rotates through multiple Google accounts to distribute rate limits. Exposes an OpenAI-compatible endpoint at `/v1` on port 8045.

### Quick Reference

```
Manager port: 8045
Web Admin UI: http://localhost:8045/
Docker NAME:  antigravity-manager
Image:        antigravity-manager:patched
OpenCode config: ~/.config/opencode/opencode.json (provider: "antigravity-manager")
Accounts file:   /home/yapilwsl/.antigravity_tools/accounts.json
GUI config:      /home/yapilwsl/.antigravity_tools/gui_config.json
```

### Control Commands

```bash
# Check status
docker ps | grep antigravity-manager

# Start / Stop / Restart
docker start antigravity-manager
docker stop antigravity-manager
docker restart antigravity-manager

# Live logs
docker logs -f antigravity-manager
```

### Management API (Port 8045)

Requires `Authorization: Bearer admin` or `x-api-key: admin`:

- `GET /api/accounts` — list accounts
- `POST /api/accounts` — add account (body: `{"refreshToken": "...", "name": "..."}`)
- `GET /api/proxy/status` — proxy status
- `POST /api/proxy/start` — start proxy routing if stopped

### OpenCode Provider Configuration

The `antigravity-manager` provider in `~/.config/opencode/opencode.json` uses `@ai-sdk/openai-compatible`:

```json
"antigravity-manager": {
  "npm": "@ai-sdk/openai-compatible",
  "name": "Antigravity Manager",
  "options": {
    "baseURL": "http://127.0.0.1:8045/v1",
    "apiKey": "sk-antigravity"
  }
}
```

**Model format:** `antigravity-manager/gemini-3-flash`

> **⚠️ Must use `@ai-sdk/openai-compatible`, NOT `@ai-sdk/openai`.**
> `@ai-sdk/openai` v3 has a Responses API code path that serializes tool calls as `{ type: "function_call" }` content blocks. The manager's Rust parser doesn't recognize `function_call`, causing `400 Bad Request`.

### How Account Rotation Works

The manager selects the best healthy account from the pool for each request.

- If an account hits a rate limit (429/529) or billing wall, it is temporarily deprioritized/marked unhealthy.
- The manager automatically rotates to the next available account.
- Handled completely upstream in the Docker container; OpenCode only sees a standard OpenAI-compatible server.

### Troubleshooting

#### `__cloudCodeMeta` SSE Chunk Error

**Symptoms:** Streaming responses fail with `Type validation failed: choices expected array, received undefined`.

**Root Cause:** antigravity-manager v4.2.2+ injects `{"__cloudCodeMeta":{"traceId":"req_..."}}` as the first SSE chunk. The Vercel AI SDK's zod validator rejects it because it has no `choices` array.

**Fix:** Patch `@ai-sdk/provider-utils` `parseJsonEventStream` in both CJS and ESM dist files:

Files to patch:
- `~/.config/opencode/node_modules/@ai-sdk/provider-utils/dist/index.js` (CJS)
- `~/.config/opencode/node_modules/@ai-sdk/provider-utils/dist/index.mjs` (ESM)

In the `TransformStream` transform function, add before the `safeParseJSON` call:
```js
if (data.includes("__cloudCodeMeta")) {
  return;
}
```

#### 400 Bad Request: "data did not match any variant of untagged enum OpenAIContent"

**Symptoms:** First message works, but follow-up messages fail with `400 Bad Request`.

**Root Cause:** Two known sub-issues:

1. **`output_text` content type (fixed in manager):** OpenCode sends assistant messages with `"type": "output_text"`. The manager's Rust `OpenAIContentBlock` enum only handled `"text"` and `"input_text"`. Fixed by adding `alias = "output_text"` in the manager's `models.rs`. Patched image: `antigravity-manager:patched`.

2. **`function_call` content type (fixed by provider switch):** `@ai-sdk/openai` v3 Responses API path serializes tool calls as `{ type: "function_call" }` content blocks. Fixed by switching to `@ai-sdk/openai-compatible`.

**Verification:**
```bash
grep '"npm"' ~/.config/opencode/opencode.json | grep antigravity
ls ~/.config/opencode/node_modules/@ai-sdk/openai-compatible/
```

#### 400 Bad Request: Gemini Pro `max_tokens` Ceiling

Gemini Pro models enforce a maximum output token limit of exactly **65535**. Sending 65536 causes `400 Bad Request: Request contains an invalid argument`. Ensure all Pro model definitions use `max_tokens: 65535` or lower.

#### 400 Bad Request: `thought_signature` Requirement

Gemini reasoning Pro models require a cryptographic `thought_signature` for historical tool calls. Standard OpenAI tool format lacks this. Use `gemini-3-flash` for heavy tool execution workloads; limit Pro models to conversation-heavy operations.

### Syncing Accounts from Manager to OpenCode Rotator

> **⚠️ The OpenCode Google OAuth rotator (`ocagvrotate` plugin) is secondary. Account rotation is primarily handled by the `antigravity-manager` Docker container. Sync is only needed if you still use the legacy `google/antigravity-*` model path.**

When adding new accounts to `antigravity-manager`, optionally sync them to `~/.config/opencode/antigravity-accounts.json`:

1. Find account in `/home/yapilwsl/.antigravity_tools/accounts/{uuid}.json`
2. Copy `token.refresh_token` → `refreshToken` (strip any `|project|managedProject` suffix)
3. **Do NOT copy `token.project_id`**
4. Preserve existing `fingerprint` if present
5. Check for multiple files with same email — use newest `mtime`
