# Google Antigravity Limits & Quota Pools

Google maintains two distinct quota buckets for your account based on how you connect to the Antigravity API. Understanding these limits is critical for maximizing availability and avoiding rate limits.

## 1. Two Separate Quota Pools

* **Antigravity Quota**: Used by the default models (like `antigravity-gemini-3-flash`, `antigravity-claude-opus-4-6-thinking`). The plugin mimics the official Antigravity Electron Desktop App by sending specific browser-like User-Agent and device fingerprint headers.
* **Antigravity CLI Quota**: Used by the models labeled "Antigravity CLI" (like `gemini-3-flash-preview` or `gemini-2.5-pro`). The plugin switches its headers to mimic the Go-based Antigravity Command Line Interface (`antigravity-cli`).

## 2. What Limits Apply

By using the CLI models, you are consuming the limits designated for the Antigravity CLI tool rather than the Antigravity desktop IDE.
- Both pools abide by the **5-hour dynamic window** and **7-day weekly cap**, but they are tracked in completely separate buckets.
- If you exhaust your standard Antigravity quota, switching to a CLI model essentially gives you a fresh secondary quota pool to draw from using the exact same Google account.

## 3. Explicit Routing (Post-June 2026)

Previously, the plugin used to automatically failover between these two quota pools if one got exhausted. However, because Google shut down the fallback sandbox endpoints on June 18, 2026, **automatic failover between the two pools was removed**. 

Now, the routing is explicit:
- If you select an `antigravity-*` model, you strictly use the IDE quota.
- If you select a CLI model (`gemini-*-preview` or `gemini-2.5-*`), you strictly use the CLI quota.

*(Note: Claude and image models always route through the standard Antigravity IDE quota, as they are not officially exposed through the CLI).*
