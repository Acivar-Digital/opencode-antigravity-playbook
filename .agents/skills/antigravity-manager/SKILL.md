---
name: antigravity-manager
description: Antigravity Manager Docker container for OpenCode. Use when the user asks about Antigravity manager, account rotation, starting/stopping the manager, adding accounts, or troubleshooting manager issues.
---

# Antigravity Manager

Headless Docker container that rotates through multiple Google accounts to distribute rate limits. Exposes an OpenAI-compatible endpoint at `/v1` on port 8045.

## Quick Reference

```
Manager port: 8045
Web Admin UI: http://localhost:8045/
Docker NAME:  antigravity-manager
Image:        antigravity-manager:patched
OpenCode config: ~/.config/opencode/opencode.json (provider: "antigravity-manager")
Accounts file:   /home/yapilwsl/.antigravity_tools/accounts.json
GUI config:      /home/yapilwsl/.antigravity_tools/gui_config.json
```

## Control Commands

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

## Management API (Port 8045)

Requires `Authorization: Bearer admin` or `x-api-key: admin`:

- `GET /api/accounts` — list accounts
- `POST /api/accounts` — add account (body: `{"refreshToken": "...", "name": "..."}`)
- `GET /api/proxy/status` — proxy status
- `POST /api/proxy/start` — start proxy routing if stopped

## OpenCode Provider Configuration

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

## How Account Rotation Works

The manager selects the best healthy account from the pool for each request.

- If an account hits a rate limit (429/529) or billing wall, it is temporarily deprioritized/marked unhealthy.
- The manager automatically rotates to the next available account.
- Handled completely upstream in the Docker container; OpenCode only sees a standard OpenAI-compatible server.

## Troubleshooting

### `__cloudCodeMeta` SSE Chunk Error

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

### 400 Bad Request: "data did not match any variant of untagged enum OpenAIContent"

**Symptoms:** First message works, but follow-up messages fail with `400 Bad Request`.

**Root Cause:** Two known sub-issues:

1. **`output_text` content type (fixed in manager):** OpenCode sends assistant messages with `"type": "output_text"`. The manager's Rust `OpenAIContentBlock` enum only handled `"text"` and `"input_text"`. Fixed by adding `alias = "output_text"` in the manager's `models.rs`. Patched image: `antigravity-manager:patched`.

2. **`function_call` content type (fixed by provider switch):** `@ai-sdk/openai` v3 Responses API path serializes tool calls as `{ type: "function_call" }` content blocks. Fixed by switching to `@ai-sdk/openai-compatible`.

**Verification:**
```bash
grep '"npm"' ~/.config/opencode/opencode.json | grep antigravity
ls ~/.config/opencode/node_modules/@ai-sdk/openai-compatible/
```

### 400 Bad Request: Gemini Pro `max_tokens` Ceiling

Gemini Pro models enforce a maximum output token limit of exactly **65535**. Sending 65536 causes `400 Bad Request: Request contains an invalid argument`. Ensure all Pro model definitions use `max_tokens: 65535` or lower.

### 400 Bad Request: `thought_signature` Requirement

Gemini reasoning Pro models require a cryptographic `thought_signature` for historical tool calls. Standard OpenAI tool format lacks this. Use `gemini-3-flash` for heavy tool execution workloads; limit Pro models to conversation-heavy operations.

## Syncing Accounts from Manager to OpenCode Rotator

> **⚠️ The OpenCode Google OAuth rotator (`ocagvrotate` plugin) is secondary. Account rotation is primarily handled by the `antigravity-manager` Docker container. Sync is only needed if you still use the legacy `google/antigravity-*` model path.**

When adding new accounts to `antigravity-manager`, optionally sync them to `~/.config/opencode/antigravity-accounts.json`:

1. Find account in `/home/yapilwsl/.antigravity_tools/accounts/{uuid}.json`
2. Copy `token.refresh_token` → `refreshToken` (strip any `|project|managedProject` suffix)
3. **Do NOT copy `token.project_id`**
4. Preserve existing `fingerprint` if present
5. Check for multiple files with same email — use newest `mtime`
