---
name: antigravity-manager
description: Crush Antigravity multi-account session manager. Use when the user asks about Antigravity manager, account rotation, starting/stopping the manager, adding accounts, or troubleshooting manager issues.
---

You are managing the Antigravity Manager for Crush. This manager operates as a headless Docker container, rotating through multiple Google accounts backing the Antigravity API to distribute rate limits.

## Quick Reference

```
Manager port: 8045
Web Admin UI: http://localhost:8045/
Docker NAME:  antigravity-manager
Image:        lbjlaq/antigravity-manager:latest
GUI Config:    /home/yapilwsl/.antigravity_tools/gui_config.json
Accounts File: /home/yapilwsl/.antigravity_tools/accounts.json
Ctrl Script:  (uses docker standard commands)
Startup Script: /home/yapilwsl/arthityap/crush/crush-start.sh
Global Config:/home/yapilwsl/.local/share/crush/crush.json
```

## Control Commands

### Quick Start (after reboot)

Run the unified startup script to start **both** Antigravity Manager (Docker) and OpenRouter Proxy:

```bash
/home/yapilwsl/arthityap/crush/crush-start.sh
```

### Docker Container

Run standard docker CLI commands to manage the container:

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

The container exposes a Management API requiring `Authorization: Bearer admin` or `x-api-key: admin` (with password `admin`):

- `GET /api/accounts` — list accounts
- `POST /api/accounts` — add account (body: `{"refreshToken": "...", "name": "..."}`)
- `GET /api/proxy/status` — proxy status
- `POST /api/proxy/start` — start proxy routing if stopped

## Crush Provider Setup

You must configure `antigravity-manager` in your project `crush.json` (or global config `~/.local/share/crush/crush.json`) as `type: "openai-compat"`:

```json
"antigravity-manager": {
  "type": "openai-compat",
  "base_url": "http://localhost:8045/v1",
  "api_key": "sk-antigravity",
  "models": [
    { "id": "gemini-3-flash", "name": "Gemini 3 Flash", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 1048576, "default_max_tokens": 65535 },
    { "id": "gemini-3.1-pro-high", "name": "Gemini 3.1 Pro High", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 1048576, "default_max_tokens": 65535 },
    { "id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5 (20251001)", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 200000, "default_max_tokens": 8192 },
    { "id": "claude-haiku-4", "name": "Claude Haiku 4", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 200000, "default_max_tokens": 8192 },
    { "id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet (20241022)", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 200000, "default_max_tokens": 8192 },
    { "id": "claude-3-5-sonnet-20240620", "name": "Claude 3.5 Sonnet (20240620)", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 200000, "default_max_tokens": 8192 },
    { "id": "claude-opus-4-5-20251101", "name": "Claude Opus 4.5 (20251101)", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 200000, "default_max_tokens": 8192 },
    { "id": "claude-opus-4-5-thinking", "name": "Claude Opus 4.5 Thinking", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 200000, "default_max_tokens": 32768 },
    { "id": "claude-opus-4-6", "name": "Claude Opus 4.6", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 200000, "default_max_tokens": 8192 },
    { "id": "claude-opus-4", "name": "Claude Opus 4", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 200000, "default_max_tokens": 8192 },
    { "id": "claude-opus-4-6-thinking", "name": "Claude Opus 4.6 Thinking", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 200000, "default_max_tokens": 64000 },
    { "id": "claude-3-haiku-20240307", "name": "Claude 3 Haiku (20240307)", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 200000, "default_max_tokens": 4096 },
    { "id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 200000, "default_max_tokens": 64000 },
    { "id": "claude-opus-4-6-20260201", "name": "Claude Opus 4.6 (20260201)", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 200000, "default_max_tokens": 8192 },
    { "id": "claude-sonnet-4-5", "name": "Claude Sonnet 4.5", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 200000, "default_max_tokens": 8192 },
    { "id": "gemini-pro-agent", "name": "Gemini Pro Agent", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 1048576, "default_max_tokens": 65535 },
    { "id": "gpt-oss-120b-medium", "name": "GPT-OSS 120B Medium", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 128000, "default_max_tokens": 16384 },
    { "id": "gemini-3.5-flash-low", "name": "Gemini 3.5 Flash Low", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 1048576, "default_max_tokens": 65535 },
    { "id": "gemini-3.5-flash-extra-low", "name": "Gemini 3.5 Flash Extra Low", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 1048576, "default_max_tokens": 65535 },
    { "id": "gemini-3.1-pro-low", "name": "Gemini 3.1 Pro Low", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 1048576, "default_max_tokens": 65535 },
    { "id": "gemini-3.1-flash-lite", "name": "Gemini 3.1 Flash Lite", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 1048576, "default_max_tokens": 65535 },
    { "id": "gemini-3.1-flash-image", "name": "Gemini 3.1 Flash Image", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 1048576, "default_max_tokens": 65535 },
    { "id": "gemini-3-flash-agent", "name": "Gemini 3 Flash Agent", "cost_per_1m_in": 0, "cost_per_1m_out": 0, "context_window": 1048576, "default_max_tokens": 65535 }
  ]
}
```

## How Account Rotation Works

The manager selects the best healthy account from the pool for each request.

- If an account hits a rate limit (429/529) or billing wall, it is temporarily deprioritized/marked unhealthy.
- The manager automatically rotates to the next available account.
- Handled completely upstream in the headless docker container; Crush only sees a standard OpenAI-compatible server.

## Syncing Accounts to OpenCode Rotator

> **⚠️ Deprecated:** The OpenCode Google OAuth rotator (`ocagvrotate` plugin) is planned for decommission. Account rotation is now handled entirely by the `antigravity-manager` Docker container. The sync step below is only needed if you still use the legacy `google/antigravity-*` model path.

When adding new accounts to `antigravity-manager`, also sync them to the OpenCode Google OAuth rotator config (`~/.config/opencode/antigravity-accounts.json`) to keep both in sync.
Refer to the `google-oauth-accounts` skill (`.opencode/skills/google-oauth-accounts/SKILL.md`) for detailed sync instructions and integration tests.

---

## 4. Upstream Gemini Pro Troubleshooting Playbook

### The `max_tokens` Limit Ceilings
* **CRITICAL ceiling for Gemini Pro (`gemini-pro-agent` / `gemini-3.1-pro-high`):** Google's reasoning Pro models enforce a maximum output token limit of exactly **`65535`**. 
* **The Bug:** If Crush sends `max_tokens: 65536` ($2^{16}$), Google's API instantly rejects the entire request payload with `400 Bad Request: Request contains an invalid argument`. 
* **The Fix:** Ensure all Pro model definitions in `crush.json` and the global `~/.local/share/crush/crush.json` set `default_max_tokens` or `max_tokens` to exactly `65535` or lower.

### The "thought_signature" Tool Call Requirement
* Google's Gemini reasoning Pro models (`gemini-pro-agent`) require a cryptographic `thought_signature` for all historical tool calls in the conversation history. 
* **The Limitation:** Because standard OpenAI tools formats lack this signature, using tools with Gemini Pro via the `antigravity-manager` translation layer will result in a 400 Bad Request.
* **The Standard Workaround:** Use `gemini-3-flash` (which does not enforce thought signatures) when running heavy tool execution agent workloads, and limit Pro models to conversation-heavy operations.

---

## 5. OpenCode Provider Configuration

### Working Configuration (OpenAI-Compatible Provider)
The `antigravity-manager` container exposes a fully OpenAI-compatible endpoint at `/v1`. Use the `@ai-sdk/openai-compatible` provider in OpenCode:

```json
"provider": {
  "antigravity-manager": {
    "npm": "@ai-sdk/openai-compatible",
    "name": "Antigravity Manager",
    "options": {
      "baseURL": "http://127.0.0.1:8045/v1",
      "apiKey": "sk-antigravity"
    }
  }
}
```

**Model format:** `antigravity-manager/gemini-3-flash`

> **⚠️ Must use `@ai-sdk/openai-compatible`, NOT `@ai-sdk/openai`.**
> `@ai-sdk/openai` v3 has a **Responses API** code path that serializes assistant tool calls as `{ type: "function_call", ... }` content blocks instead of the standard Chat Completions `tool_calls` array. The antigravity-manager's Rust parser (`OpenAIContent` enum) doesn't recognize `function_call` as a content type, causing `400 Bad Request: data did not match any variant of untagged enum OpenAIContent`. The `@ai-sdk/openai-compatible` provider (v2.x) only uses the standard Chat Completions format.

### Why Not `api: "google"`?
The `api: "google"` provider with `baseURL: /v1beta` sends requests to Google's native endpoint (`/v1beta/models/{model}:streamGenerateContent`). While this works for raw curl requests, OpenCode's Google SDK (`@ai-sdk/google`) constructs URLs and headers that can conflict with the antigravity-manager's translation layer, causing `405 Method Not Allowed` errors. The OpenAI-compatible `/v1/chat/completions` path is more reliable because:

1. The manager's OpenAI translation layer is battle-tested and handles all model types (Gemini, Claude, GPT)
2. OpenCode's `@ai-sdk/openai-compatible` provider uses standard Chat Completions format (no Responses API)
3. Account rotation, quota management, and model translation are all handled upstream in the Docker container

### The `__cloudCodeMeta` Issue (Historical)
Earlier attempts to use `api: "google"` with the native Google streaming endpoint caused crashes because the manager passed through proprietary Google metadata (`__cloudCodeMeta`) as the first SSE chunk. OpenCode's Vercel AI SDK expected standard OpenAI `choices` arrays and threw a type validation failure. The OpenAI-compatible `/v1` endpoint avoids this entirely by translating all responses to standard OpenAI format.
