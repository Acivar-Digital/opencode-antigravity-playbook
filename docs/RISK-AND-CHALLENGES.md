# Architecture, Risks, and Challenges

This document outlines the high-level architecture of the `opencode-antigravity-auth` plugin, the technical challenges faced during its implementation, and the severe operational risks associated with its use.

---

## ⚠️ Terms of Service (ToS) Warning

> [!CAUTION]
> **This plugin explicitly violates Google's Terms of Service.**
> By proxying, rotating, or programmatically accessing Antigravity (Google's IDE) companion APIs outside of the official IDE client, you run a high risk of:
> - **Account Suspension / Banning:** Permanent loss of access to your Google accounts, associated GCP projects, and cloud resources.
> - **Shadow-Banning:** Restricted API access or silently reduced quotas without explicit notifications.
> - **IP Blocks:** Rate-limiting or outright blacklisting of hosting/residential IP addresses.
>
> This tool is strictly for personal/internal development and educational research. The developers and maintainers assume no liability for account suspensions or data loss.

---

## 1. High-Level Architecture

The plugin acts as a request interception proxy that hooks into OpenCode's execution flow.

```
                    ┌────────────────────────┐
                    │  OpenCode Agent Loop   │
                    └───────────┬────────────┘
                                │ (fetch requests to Gemini/Claude)
                                ▼
         ┌──────────────────────────────────────────────┐
         │     opencode-antigravity-auth Plugin          │
         │                                              │
         │  1. Intercepts fetch() requests              │
         │  2. Resolves & rotates target Google account │
         │  3. Normalizes MCP schemas (removes invalid) │
         │  4. Injects valid Fingerprint/UA headers     │
         │  5. Strips Claude thinking signatures        │
         └──────────────────────┬───────────────────────┘
                                │
               ┌────────────────┴────────────────┐
               ▼ (Antigravity Headers)           ▼ (Antigravity CLI Headers)
     ┌───────────────────────────┐     ┌───────────────────────────┐
     │  Google Antigravity API   │     │  Google Antigravity CLI   │
     └───────────────────────────┘     └───────────────────────────┘
```

### Key Components
- **Fetch Interceptor (`src/plugin.ts`):** Intercepts standard Google AI API endpoint calls.
- **Account Manager (`src/plugin/accounts.ts`):** Manages a local pool of authenticated accounts, rotating them based on rate limits (`429`) or quota exhaustion.
- **Request Transformer (`src/plugin/request.ts`):** Maps standard OpenCode payloads to Google companion API formats, aligning headers and styling parameters.
- **Schema Sanitizer (`src/plugin/transform/cross-model-sanitizer.ts`):** Standardizes tool schemas before transmission.
- **Fingerprint Generator (`src/plugin/fingerprint.ts`):** Generates and stores device signatures to match genuine client profiles.

---

## 2. Implementation Challenges & Mitigations

### Challenge A: Strict Schema and Protobuf Validation (Google 400s)
* **The Problem:** The Google companion backend uses strict protocol buffers. If an MCP server declares a parameter using unsupported schema fields (like `anyOf`, `$ref`, `$defs`, or numeric keys), the API rejects the request with a `400 Invalid Argument` error.
* **The Mitigation:** The plugin parses tool configurations on the fly and strips invalid keywords, flattening schema definitions into pure types that conform to the target API structure.

### Challenge B: Account Rotation Synchronization & Cursors
* **The Problem:** Under high parallel load (e.g., spawning multiple subagents), multiple requests hit rate limits concurrently. If account selection cursors are not synchronized across processes, it can cause index collision, leading to rate limit loops or lockups.
* **The Mitigation:** We implemented file locking (`proper-lockfile`) on the storage state and fixed the rotation algorithm (`getNextForFamily` in `accounts.ts`) to sweep the entire array uniformly using a persistent cursor.

### Challenge C: Compute-Based Quota Shifts
* **The Problem:** Google shifted from simple call count metrics to a **Compute-Based Model** (measuring token weight and context depth). This causes rapid quota depletion during long agent loops.
* **The Mitigation:** The plugin tracks remaining quota fractions (`remainingFraction`) and reset windows (`resetTime`) across multiple accounts. It proactively skips accounts exceeding a configurable soft-quota threshold (default 90%) to prevent Google's security systems from flagging heavily exhausted accounts.

### Challenge D: User-Agent Fingerprinting
* **The Problem:** Google monitors API requests for bot-like signatures. Simple header spoofing gets blocked quickly.
* **The Mitigation:** The system generates and caches unique device fingerprints (including `deviceId` and `sessionToken`) matching official Electron (`antigravity`) and Go CLI (`antigravity-cli`) client profiles.

---

## 3. Operational Best Practices

To minimize security issues and maximize account lifespans:
1. **Enable Soft Quotas:** Set `soft_quota_threshold_percent: 90` to leave safety margins on your accounts.
2. **Use Sticky Routing:** Use `"account_selection_strategy": "sticky"` for long agent sessions to maximize Google's prompt caching mechanisms and reduce input compute costs.
3. **Rotate IPs:** Avoid running many high-frequency requests from a single datacenter IP address.
