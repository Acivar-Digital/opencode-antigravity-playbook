# Changelog

## [2.6.1] - 2026-06-19

### Changed
- **Skills overhaul — antigravity-manager and google-oauth-accounts:** Both skills rewritten to match current reality. Removed all "Crush" platform references, stale paths (`crush.json`, `~/.local/share/crush/`), old model lists, and outdated plugin internal file references. antigravity-manager skill now focuses on Docker container management and OpenCode provider config. google-oauth-accounts skill now documents current state (6 accounts, round-robin strategy, current config values). Created `docs/GRAVEYARD.md` with archived deprecated content.

## [2.6.0] - 2026-06-18

### Changed
- **Antigravity Manager as primary provider:** OpenCode now uses the `antigravity-manager` Docker container as its primary provider via the OpenAI-compatible endpoint (`npm: "@ai-sdk/openai-compatible"`, `baseURL: http://127.0.0.1:8045/v1`). The `@ai-sdk/openai-compatible` package is required (not `@ai-sdk/openai`) because v3's Responses API path serializes tool calls as `{ type: "function_call" }` content blocks which the manager's Rust parser rejects. This replaces the previous `api: "google"` + `/v1beta` configuration which caused `405 Method Not Allowed` errors due to URL/header conflicts between OpenCode's Google SDK and the manager's translation layer.
- **OpenCode rotator planned for decommission:** The `ocagvrotate` plugin's built-in account rotator is now deprecated. All account rotation, rate limit handling, and quota management is handled upstream by the `antigravity-manager` Docker container. The plugin remains in the config for backward compatibility but is no longer the primary rotation mechanism.

### Fixed
- **405 Method Not Allowed with antigravity-manager:** Resolved by switching from `api: "google"` (native Google SDK path) to `npm: "@ai-sdk/openai"` (OpenAI-compatible `/v1/chat/completions` path), which the manager fully supports and translates internally.
- **400 Bad Request on follow-up messages (output_text):** OpenCode sends assistant messages with `"type": "output_text"` in the content array, but the antigravity-manager's Rust deserializer only handled `"text"` and `"input_text"`. Added `"output_text"` as a serde alias to the `OpenAIContentBlock::Text` variant in the manager's `models.rs`. This fixes multi-turn conversations where the first message worked but all subsequent messages failed with `Bad Request: Invalid request: data did not match any variant of untagged enum`. Patched Docker image deployed.
- **400 Bad Request with tool_calls in conversation history (function_call):** `@ai-sdk/openai` v3 has a **Responses API** code path that serializes assistant tool calls as `{ type: "function_call", ... }` content blocks instead of the standard Chat Completions `tool_calls` array. The antigravity-manager's Rust `OpenAIContent` enum doesn't recognize `function_call` as a content type, causing `400 Bad Request: data did not match any variant of untagged enum OpenAIContent`. Fixed by switching the OpenCode provider from `"npm": "@ai-sdk/openai"` to `"npm": "@ai-sdk/openai-compatible"` which only uses the standard Chat Completions format. Also installed `@ai-sdk/openai-compatible` in `~/.config/opencode/node_modules/`.
- **400 Bad Request: `__cloudCodeMeta` SSE chunk causes type validation failure:** The antigravity-manager (v4.2.2+) injects `{"__cloudCodeMeta":{"traceId":"req_..."}}` as the first SSE chunk in every streaming response. The Vercel AI SDK (`@ai-sdk/openai-compatible`) tries to parse it as an OpenAI `chat.completion.chunk`, finds neither `choices` nor `error`, and throws `Type validation fixed`. Fixed by patching `@ai-sdk/provider-utils` `parseJsonEventStream` in both CJS (`dist/index.js`) and ESM (`dist/index.mjs`) to skip SSE data lines containing `__cloudCodeMeta` before zod validation. Also filtered in `src/plugin/core/streaming/transformer.ts` for the Google OAuth path (plugin intercepts `generativelanguage.googleapis.com`). The SDK-level patch is the correct fix for the manager path (`127.0.0.1:8045`); the plugin-level filter is correct for the OAuth path.
- **400 Bad Request on Gemini 3.1 APIs (element predicate failed):** Fixed an issue where the proxy injected `HARM_CATEGORY_CIVIC_INTEGRITY` into safety settings for Google Gemini payloads. Google removed support for this category in `gemini-3.1-flash-lite`, causing requests to fail. Removed `CIVIC_INTEGRITY` from the hardcoded Rust mappers (`proxy/mappers/openai/request.rs`, `proxy/mappers/claude/request.rs`, and `proxy/handlers/openai.rs`). Patched Docker image deployed.

### Added
- **Session Context Capture system:** Added post-commit hook (`.git/hooks/post-commit` + tracked copy `.beads/hooks/post-commit`) that auto-creates a beads checkpoint issue (priority 4) on every commit with commit metadata (hash, branch, author, files changed, diff stats).
- **On Issue Resolution workflow:** Mandatory 6-step workflow triggered when user explicitly acknowledges resolution: close beads issue → update beads-usage skill → update CHANGELOG → update README (if user-facing) → commit and push → sync skill to VPS.
- **Session Context Capture section in AGENTS.md:** Mandatory conventions for session start (read notes/design), commit enrichment (what was tried/failed/worked), and session end (summary, push, cleanup).
- **Checkpoint enrichment convention:** Agent must enrich auto-created P4 checkpoint issues with session context; periodic bulk-cleanup of checkpoints.

### Changed
- **beads-usage skill expanded:** Added embedded Dolt architecture (no server), post-commit hook architecture diagram, session context capture workflow, checkpoint enrichment, issue resolution workflow, and anti-patterns table.
- **AGENTS.md consolidated:** Removed redundant "Session Completion" section; all session lifecycle rules now under "Session Context Capture".

## [2.4.1] - 2026-06-15

### Fixed
- **Missing Cache Patch for Deletion Operations:** Re-applied and verified the missing `saveAccountsReplace` cache patch in `storage.js` for `opencode-antigravity-auth` plugin. This ensures banned accounts are consistently stripped and force-enabled accounts (such as Emily) remain active even during destructive account replacement writes.
- **Stale Rate Limits Clean-up:** Purged obsolete rate limit reset timestamps and reset active account routing indices in `antigravity-accounts.json` to prevent stuck selection loops.

## [2.4.0] - 2026-06-15

### Added
- **Local Codebase Indexing configuration & Matryoshka dimensions patch:** Added project-level `opencode.json` configuration and `.opencode/codebase-index.json` supporting local semantic codebase search via the `mcpmart` API Gateway. Patched `opencode-codebase-index` files (`dist/index.js`, `dist/cli.js`, `dist/index.cjs`, `dist/cli.cjs`) to correctly forward the `dimensions: this.modelInfo.dimensions` parameter in custom embeddings requests, enabling 768D Matryoshka Representation Learning (MRL) truncation.
- **Custom Provider baseUrl Warning Silencing:** Patched `opencode-codebase-index` files to comment out the default `console.warn` that outputted the `customProvider.baseUrl does not end with /v1` warning, keeping TUI and stdout/stderr completely clean when routing to custom gateways.
- **Retrieved & Synchronized Codebase Indexing Skills:** Copied global OpenCode skills `answer-codebase-indexing` and `setup-codebase-indexing` from the VPS to this local machine's configuration folder and updated the setup instructions with the warnings silencing steps.

## [2.3.2] - 2026-06-15

### Fixed
- **Google OAuth API Key Validation Error:** Removed the `"key": "dummy"` entry in the Google provider section of `auth.json` which triggered client-side validation failures in the `@ai-sdk/google` SDK (e.g., `API key not valid`) before requests could be intercepted by the plugin's `fetch` hook.

## [2.3.1] - 2026-06-15

### Fixed
- **Index Specifier Resolution in ESM:** Added explicit `.js` suffixes (`./src/plugin.js` and `./src/antigravity/oauth.js`) in `index.ts` to prevent name collision with the `src/plugin` directory, resolving `ERR_UNSUPPORTED_DIR_IMPORT` in native Node.js ESM.
- **Account Saving Filter Logic:** Fixed an issue in `src/plugin/storage.ts` where account objects without an explicit `email` property were stripped during the write-time banned/force-enable filtering, resolving mock test failures.
- **Remote Host Deployment & Config Sync:** Synchronized `antigravity.json` config settings and deployed the patched package structure across the target Mac Mini (`yapilymm`) and VPS (`vps466a`) environments.

## [2.3.0] - 2026-06-14

### Added
- **Compute-Based Quota Model (June 18, 2026 Shift):** Implemented active local compute tracking supporting Google's compute-based usage model. 
- **Double Rolling Windows:** Tracks a 5-hour local dynamic window and 7-day weekly cap totals locally.
- **Variable-Cost Hybrid Selection:** Integrates estimated compute costs (prompt complexity, history context, tools, and reasoning multipliers) into the Hybrid load balancing strategy. Includes `safety_margin_percent` validation to preemptively skip accounts before exhaustion.
- **Log Capping & Exception Isolation:** Enforces a 200-entry hard cap on persistent local usage logs to prevent unbounded file size growth, and wraps metrics updates in robust try/catch blocks for silent error recovery.

## [2.2.2] - 2026-06-14

### Fixed
- **VPS Auth Sync & Mirroring:** Added support for copying `auth.json` to the VPS in `implement-on-vps.sh` to prevent `API key not valid` errors caused by Google being configured as an `api` provider instead of `oauth`. Added troubleshooting notes about TUI-focused execution on VPS.

## [2.2.1] - 2026-06-14

### Added
- **Unified Chrome Telemetry Spoofing:** Upgraded the `antigravity-cli` request path to also inject the same high-fidelity Chrome browser telemetry headers (User-Agent, `sec-ch-ua-*`, and consistency headers) as the main `antigravity` path, while preserving `Client-Metadata`. This ensures consistent browser-like traffic signatures across all API endpoints.

## [2.2.0] - 2026-06-14

### Added
- **Chrome Telemetry & Header Spoofing:** Implemented a high-fidelity Chrome telemetry emulation layer on content requests (User-Agent + Client Hints + Google Update/Extension headers). Includes `sec-ch-ua`, `sec-ch-ua-platform`, `sec-ch-ua-platform-version`, `sec-ch-ua-arch`, `sec-ch-ua-bitness`, `sec-ch-ua-mobile`, `sec-ch-ua-model`, `sec-ch-ua-form-factors`, `sec-ch-ua-full-version`, `sec-ch-ua-full-version-list`, `sec-ch-ua-wow64`, `x-client-data` (Chrome Variations), `x-browser-channel`, `x-browser-year`, `x-browser-copyright`, `x-browser-validation`, `x-chrome-id-consistency-request`, and `x-goog-update-*` headers.
- **SSL MITM Capture Proxy:** Added an HTTPS interception proxy under `admin/capture/proxy` utilizing system `openssl` for dynamic certificate signing to inspect and log outgoing Antigravity IDE HTTP traffic.
- **Capture Analyzer:** Added a telemetry diff analyzer under `admin/capture/analyze` to perform a side-by-side gap analysis comparing captured IDE traffic against the plugin's headers.
- **Persistent Machine Identity:** Added `syncAccountId` parsing from the OAuth userinfo endpoint, ensuring a stable per-account machine fingerprint and preventing rate limits or security blocks.

### Changed
- **Content Headers Cleanup:** Removed redundant/invalid `X-Goog-Api-Client` and `Client-Metadata` headers from the `antigravity` content request path to align with legitimate IDE requests.
- **Proxy Security Hardening:** Switched capture proxy to generate isolated per-host private keys and hardened key permissions (`0600`).
- **Log Data Redaction:** Implemented query parameter redaction in proxy logging to prevent accidental token exposure.

### Fixed
- **Linux Architecture Telemetry:** Fixed a bug in `sec-ch-ua-arch` mapping where Linux hosts were misidentified as `x86` instead of `arm`.

## [2.1.0] - 2026-06-14

### Added
- **Admin Fetch-Now Tool:** Added `admin/fetch-now` and `admin/fetch-now.mjs` to force-refresh Google API quota usage details and save the refreshed state securely to the local accounts cache.
- **Core Antigravity-Manager Features Ported** - Successfully implemented 4 major Rust features directly into Node.js using TDD:
  - **Rate Limit Parser:** Added `parseDurationString` (`src/utils/rate-limit.ts`) to exactly calculate and parse complex Google API cooldown times (e.g. `2h1m25.5s`, `510.79ms`), allowing millisecond-precision session recovery.
  - **Token Saver (Background Task Downgrader):** Added `detectBackgroundTask` (`src/proxy/token-saver.ts`) to actively intercept non-critical background tasks (like `write a 5-10 word title`, `prompt suggestion generator`) and transparently route them to cheaper `gemini-2.5-flash` models.
  - **Deep JSON Schema Cleaner:** Added `cleanJsonSchema` (`src/proxy/schema-cleaner.ts`) to recursively remove unsupported MCP properties (`propertyNames`, `anyOf`, `[undefined]`), permanently fixing Gemini 3.1 Pro 400 Invalid Argument rejections on complex tool schemas.
  - **SQLite VSCDB Extractor:** Added `extractTokensFromDb` (`src/utils/vscdb-extractor.ts`) to automatically parse Base64 decoded Protobuf payloads from `state.vscdb`, drastically simplifying the extraction of Google refresh tokens and emails from existing VS Code/Antigravity Desktop databases.

### Fixed
- **CLI OS Invariant Mismatch:** Mapped Linux platforms (`process.platform === "linux"`) to `"LINUX"` instead of `"MACOS"` in the `antigravity-cli` Client-Metadata to prevent detection of mismatched telemetry headers.
- **Health Checker Default OS Telemetry:** Defaulted user-agent headers in `scripts/monitor.mjs` to Linux (`antigravity/linux/amd64`) and added an explicit dashboard warning prompt indicating the assumed host platform.

## [2.0.0] - 2026-06-18

### Added
- **Account Health Check Script** - Added `admin/check-health.mjs` and a root-level `./health` shell script wrapper to easily monitor account statuses, enabled/disabled states, verification requirements, live/cached quotas, and cooldowns.

### Changed
- **Unified Quota System & Gemini CLI Retirement** - Replaced the dual-quota setup with a single Antigravity-only quota flow utilizing `v1internal:fetchAvailableModels`. Removed `retrieveUserQuota` endpoints completely.
- **Antigravity CLI Cutover** - Migrated fallback headers and model routing from the deprecated `gemini-cli` Node.js client to the compiled Go `antigravity-cli` protocol. Generated user-agent and client-metadata structures to perfectly match compiled Go clients.

### Fixed
- **Persistent Round-Robin Rotation** - Fixed a critical round-robin cursor bug in `getNextForFamily` where the rotation cursor indexed into the filtered available list instead of the full accounts list. This ensures uniform rotation across all accounts even when subset of accounts are temporarily rate-limited or over-quota.


## [1.6.0] - 2026-02-20

### Fixed

- **Version Patch** - Override Antigravity User-Agent version fallback to `4.2.1` and bypass updater API / local loopback connection attempts to prevent "version no longer supported" errors.

- **#397** - Gemini tool-call payload handling now enforces valid `thought_signature` behavior for `functionCall` parts, preventing `400 INVALID_ARGUMENT` in mixed and parallel call turns.

- **#454** - Request sanitization now removes empty/invalid `contents.parts` entries and invalid `systemInstruction.parts` before forwarding to Antigravity.

- **#444** - Response transform fallback now uses cloned responses and preserves recovery signaling, eliminating `Body already used` failures.

- **#368 (Tackled)** - Claude thinking/signature handling now replaces foreign signatures with sentinels and tightens thinking-order classification to reduce false-positive recovery triggers.

### Added

- **Gemini 3.5 Flash Model Support** - Added model definitions and resolution mapping for `antigravity-gemini-3.5-flash-low`, `extra-low`, and `high` model variants.

### Changed

- **Debug Sink Split** - `debug` now controls file logging only, while `debug_tui` independently controls TUI panel logging.

- **Header Normalization** - `x-goog-user-project` is now stripped across Antigravity and Gemini CLI request styles.

- **Claude Prompt Auto-Caching (Optional)** - Added `claude_prompt_auto_caching` to inject `cache_control: { type: "ephemeral" }` when Claude prompt caching is desired and unset.

### Documentation

- Updated README, architecture/config/troubleshooting docs, and generated schema docs to reflect new debug sink semantics and config keys.

## [1.5.2] - 2026-02-18

### Changed

- Added support for Sonnet 4.6 and removed old models support.

## [1.5.1] - 2026-02-11

### Changed

- **Header Identity Alignment** - `ideType` changed from `IDE_UNSPECIFIED` to `ANTIGRAVITY` and `platform` from `PLATFORM_UNSPECIFIED` to dynamic `WINDOWS`/`MACOS` (based on `process.platform`) across all header sources (`getAntigravityHeaders`, `oauth.ts`, `project.ts`). Now matches Antigravity Manager behavior

- **Gemini CLI `Client-Metadata` Header** - Gemini CLI requests now include `Client-Metadata` header, aligning with actual `gemini-cli` behavior. Previously only Antigravity-style requests sent this header

- **Gemini CLI User-Agent Format** - Updated from `GeminiCLI/{ver}/{model}` to `GeminiCLI/{ver}/{model} ({platform}; {arch})` to match real `gemini-cli` UA strings. Version pool updated from `1.2.0/1.1.0/1.0.0` to `0.28.0/0.27.4/0.27.3` to align with actual release numbers

- **Randomized Headers Model-Aware** - `getRandomizedHeaders()` now accepts an optional `model` parameter, embedding the actual model name in Gemini CLI User-Agent strings instead of a hardcoded default

- **Fingerprint Platform Alignment** - Antigravity-style `Client-Metadata` platform now consistently matches the randomized User-Agent platform, fixing a potential mismatch where headers could disagree on reported platform

### Removed

- **Linux Fingerprints** - Removed `linux/amd64` and `linux/arm64` from `ANTIGRAVITY_PLATFORMS` and fingerprint generation. Linux users now masquerade as macOS (Antigravity does not support Linux as a native platform)

- **`getAntigravityUserAgents()` Function** - Removed unused helper that had no callers in the codebase

- **`X-Opencode-Tools-Debug` Header** - Removed debug telemetry header from outgoing requests

## [1.5.0] - 2026-02-11

### Added

- **Account Verification Flow** - Auth login menu now supports `verify` and `verify-all` actions. When Antigravity returns a 403 with `validation_required`, the account is automatically disabled, marked with a verification URL, and cooled down. Users can verify accounts directly from the menu with a probe request to confirm resolution

- **Dynamic Antigravity Version** - Plugin version is now fetched at startup from the Antigravity updater API, with a changelog-scrape fallback and a hardcoded last-resort. Eliminates stale "version no longer supported" errors after Antigravity updates

- **Storage V4 Schema** - New storage version adds `verificationRequired`, `verificationRequiredAt`, `verificationRequiredReason`, `verificationUrl`, and `fingerprintHistory` fields per account. Full migration chain from v1/v2/v3 to v4

- **`saveAccountsReplace`** - New destructive-write storage function that replaces the entire accounts file without merging, preventing deleted accounts from being resurrected by concurrent reads

- **`setAccountEnabled` / Account Toggling** - New account management methods: `setAccountEnabled()`, `markAccountVerificationRequired()`, `clearAccountVerificationRequired()`, `removeAccountByIndex()`

- **Secure File Permissions** - Credential storage files are now created with mode `0600` (owner read/write only). Existing files with overly permissive modes are tightened on load

- **`opencode.jsonc` Support** - Configure models flow now detects and prefers existing `opencode.jsonc` files. JSONC parsing strips comments and trailing commas before JSON.parse

- **Header Contract Tests** - New `src/constants.test.ts` validates header shapes, randomization behavior, and optional header fields for both Antigravity and Gemini CLI styles

### Changed

- **Unified Gemini Routing** - Gemini quota fallback between Antigravity and Gemini CLI pools is now always enabled for Gemini models. The `quota_fallback` config flag is deprecated and ignored (backward-compatible, no breakage)

- **`cli_first` Honored in Routing** - `resolveHeaderRoutingDecision()` centralizes routing logic and properly respects `cli_first` for unsuffixed Gemini models

- **Fingerprint Headers Simplified** - `buildFingerprintHeaders()` now returns only `User-Agent`. Removed `X-Goog-QuotaUser`, `X-Client-Device-Id`, `X-Goog-Api-Client`, and `Client-Metadata` from outgoing content requests to align with Antigravity Manager behavior

- **Client Metadata Reduced** - Fingerprint client metadata trimmed to `ideType`, `platform`, `pluginType` only. Removed `osVersion`, `arch`, `sqmId`

- **Gemini CLI User-Agent Format** - Updated from `google-genai-sdk/...` to `GeminiCLI/...` format

- **Search Model** - Changed from `gemini-2.0-flash` to `gemini-2.5-flash` for improved search result quality

- **Deterministic Search Generation** - Search requests now use `temperature: 0` and `topP: 1` instead of thinking config

- **OAuth Headers Dynamic** - `oauth.ts` and `project.ts` now use `getAntigravityHeaders()` instead of static constants, removing stale `X-Goog-Api-Client` from token/project calls

### Fixed

- **#410**: Strip `x-goog-user-project` header for ALL header styles, not just Antigravity. This header caused 403 errors on Daily/Prod endpoints when the user's GCP project lacked Cloud Code API
- **#370 / #336**: Account deletion now persists correctly. Root cause: `saveAccounts()` merged deleted accounts back from disk. Fixed by introducing `saveAccountsReplace()` for destructive writes and syncing in-memory state immediately
- **#381**: Disabled accounts no longer selected via sticky index. `getCurrentAccountForFamily()` now skips disabled accounts and advances the active index
- **#384**: `google_search` tool no longer returns empty citations when using `gemini-3-flash`. Search model switched to `gemini-2.5-flash`
- **#377**: Configure models flow now respects existing `opencode.jsonc` files instead of creating duplicate `opencode.json`
- **Excessive Disk Writes** - Fixed project context auth updates causing 3000+ writes/sec during streaming. Changed from reference equality to value comparison on auth tokens and added throttled saves. Prevents SSD wear on macOS
- **Fingerprint Alignment** - Force-regenerated fingerprints to match current Antigravity Manager behavior, fixing `ideType` and stripping stale client metadata fields

### Removed

- **Extra Outgoing Headers** - `X-Goog-Api-Client`, `Client-Metadata`, `X-Goog-QuotaUser`, `X-Client-Device-Id` no longer sent on content requests
- **Fingerprint Metadata Fields** - `osVersion`, `arch`, `sqmId` removed from fingerprint client metadata
- **`updateFingerprintVersion` Helper** - Removed from accounts module (fingerprint version rewriting no longer needed)

### Documentation

- **AGENTS.md** expanded with detailed architecture, code style, and fingerprint system documentation
- **README.md**, **CONFIGURATION.md**, **MULTI-ACCOUNT.md** updated to reflect deprecated `quota_fallback` and automatic Gemini pool fallback behavior
- **`antigravity.schema.json`** marks `quota_fallback` as deprecated/ignored

## [1.4.5] - 2026-02-05

### Added

- **Configure Models Menu Action** - Auth login menu now includes a "Configure models" action that writes plugin model definitions directly into `opencode.json`, making setup easier for new users

- **`cli_first` Config Option** - New configuration option to route Gemini models to Gemini CLI quota first, useful for users who want to preserve Antigravity quota for Claude models

- **`toast_scope` Configuration** - Control toast visibility per session with `toast_scope: "root_only"` to suppress toasts in subagent sessions

- **Soft Quota Protection** - Skip accounts over 90% usage threshold to prevent Google penalties, with configurable `soft_quota_threshold_percent` and wait/retry behavior

- **Gemini CLI Quota Management** - Enhanced quota display with dual quota pool support (Antigravity + Gemini CLI)

- **`OPENCODE_CONFIG_DIR` Environment Variable** - Custom config location support for non-standard setups

- **`quota_refresh_interval_minutes`** - Background quota cache refresh (default 15 minutes)

- **`soft_quota_cache_ttl_minutes`** - Cache freshness control for soft quota checks

### Changed

- **Model Naming and Routing** - Documented antigravity-prefixed model names and automatic mapping to CLI preview names (e.g., `antigravity-gemini-3-flash` → `gemini-3-flash-preview`)

- **Antigravity-First Quota Strategy** - Exhausts Antigravity quota across ALL accounts before falling back to Gemini CLI quota (previously per-account)

- **Quota Routing Respects `cli_first`** - Fallback behavior updated to respect `cli_first` preference

- **Config Directory Resolution** - Now prioritizes `OPENCODE_CONFIG_DIR` environment variable

- **Enhanced Debug Logging** - Process ID included for better traceability across concurrent sessions

- **Improved Quota Group Resolution** - More consistent quota management with `resolveQuotaGroup` function

### Fixed

- **#337**: Skip disabled accounts in proactive token refresh
- **#233**: Skip sandbox endpoints for Gemini CLI models (fixes 404/403 cascade)
- **Windows Config Auto-Migration**: Automatically migrates config from `%APPDATA%\opencode\` to `~/.config/opencode/`
- **Root Session Detection**: Reset `isChildSession` flag correctly for root sessions
- **Stale Quota Cache**: Prevent spin loop on stale quota cache
- **Quota Group Default**: Fix quota group selection defaulting to `gemini-pro` when model is null

### Removed

- **Fingerprint Headers for Gemini CLI** - Removed fingerprint headers from Gemini CLI model requests to align with official behavior
- **`web_search` Configuration Leftovers** - Cleaned up remaining `web_search` config remnants from schema

### Documentation

- Updated README with model configuration options and simplified setup instructions
- Updated MODEL-VARIANTS.md with Antigravity model names and configuration guidance
- Updated CONFIGURATION.md to clarify `quota_fallback` behavior across accounts
- Updated MULTI-ACCOUNT.md with dual quota pool and fallback flow details

---

## [1.3.2] - 2026-01-27

### Added

- **Quota check and account management in auth login** - Added new `--quota` and `--manage` options to the `auth login` command for checking account quota status and managing accounts directly from the CLI ([#284](https://github.com/NoeFabris/opencode-antigravity-auth/issues/284))

- **Request timing jitter** - Added configurable random delay to requests to reduce detection patterns and improve rate limit resilience. Requests now include small random timing variations

- **Header randomization for fingerprint diversity** - Headers are now randomized to create more diverse fingerprints, reducing the likelihood of requests being grouped and rate-limited together

- **Per-account fingerprint persistence** - Fingerprints are now persisted per-account in storage, allowing consistent identity across sessions and enabling fingerprint history tracking
  - Added fingerprint restore operations to AccountManager
  - Extended per-account fingerprint history for better tracking
  - Fingerprint now shown in debug output

- **Scheduling mode configuration** - Added new scheduling modes including `cache-first` mode that prioritizes accounts with cached tokens, reducing authentication overhead

- **Failure count TTL expiration** - Account failure counts now expire after a configurable time period, allowing accounts to naturally recover from temporary issues

- **Exponential backoff for 503/529 errors** - Implemented exponential backoff with jitter for capacity-related errors, matching behavior of Antigravity-Manager

### Changed

- **Increased MODEL_CAPACITY backoff to 45s with jitter** - Extended the base backoff time for model capacity errors from previous values to 45 seconds, with added jitter to prevent thundering herd issues

- **Regenerate fingerprint after capacity retry exhaustion** - When all capacity retries are exhausted, the fingerprint is now regenerated to potentially get assigned to a different backend partition

- **Enhanced duration parsing for Go format** - Improved parsing of duration strings to handle Go-style duration formats (e.g., `1h30m`) used in some API responses

### Fixed

- **Prevent toast spam for rate limit warnings** - Added 5-second debounce for rate limit warning toasts to prevent notification flooding when multiple requests hit rate limits simultaneously ([#286](https://github.com/NoeFabris/opencode-antigravity-auth/issues/286))

- **`getEnabledAccounts` now treats undefined as enabled** - Fixed issue where accounts without an explicit `enabled` field were incorrectly filtered out. Accounts now default to enabled when the field is undefined

- **Show correct position in account toast for enabled accounts** - Fixed the account position indicator in toast notifications to only count enabled accounts, showing accurate position like "Account 2/5" instead of including disabled accounts

- **Filter disabled accounts in all selection methods** - Ensured disabled accounts are properly excluded from all account selection strategies (round-robin, least-used, random, etc.)

- **Robust handling for capacity/5xx errors** - Implemented comprehensive retry logic for model capacity and server errors, achieving parity with Antigravity-Manager's behavior
  - Reordered parsing logic to prioritize capacity checks
  - Fixed loop retry logic to prevent state pollution
  - Added capacity retry limit to prevent infinite loops ([#263](https://github.com/NoeFabris/opencode-antigravity-auth/issues/263))

- **Fixed @opencode-ai/plugin dependency location** - Moved `@opencode-ai/plugin` from devDependencies to dependencies section, fixing runtime errors when the plugin was installed without dev dependencies

### Removed

- **Removed deprecated `web_search` configuration** - The deprecated `web_search.default_mode` and `web_search.grounding_threshold` configuration options have been fully removed. Use the `google_search` tool instead (introduced in 1.3.1)

## [1.3.1] - 2026-01-21

### Added

- **New `google_search` tool for web search** - Implements Google Search grounding as a callable tool that the model can invoke explicitly
  - Makes separate API calls with only `{ googleSearch: {} }` tool, avoiding Gemini API limitation where grounding tools cannot be combined with function declarations
  - Returns formatted markdown with search results, sources with URLs, and search queries used
  - Supports optional URL analysis via `urlContext` when URLs are provided
  - Configurable thinking mode (deep vs fast) for search operations
  - Uses `gemini-3-flash` model for fast, cost-effective search operations

### Changed

- Upgraded to Zod v4 and adjusted schema generation for compatibility
- **Deprecated `web_search` config** - The `web_search.default_mode` and `web_search.grounding_threshold` config options are now deprecated. Google Search is now implemented as a dedicated tool rather than automatic grounding injection

### Fixed

- **`keep_thinking=true` now works without debug mode** - Fixed Claude multi-turn conversations failing with "Failed to process error response" when `keep_thinking=true` after tool calls, unless debug mode was enabled
  - Root cause: `filterContentArray` trusted any signature >= 50 chars for last assistant messages, but Claude returns its own signatures that Antigravity doesn't recognize
  - Fix: Now verifies signatures against our cache via `isOurCachedSignature()` before passing through. Foreign/missing signatures get replaced with `SKIP_THOUGHT_SIGNATURE` sentinel
  - Why debug worked: Debug mode injects synthetic thinking with no signature, triggering sentinel injection correctly

- **Fixed tool calls failing for tools with no parameters** - Tools like `hive_plan_read`, `hive_status`, and `hive_feature_list` that have no required parameters would fail with Zod validation error `state.input: expected record, received undefined`
  - Root cause: When Claude calls a tool with no parameters, it returns `functionCall` without an `args` field. The response transformation only processed parts where `functionCall.args` was defined, leaving `args` as `undefined`
  - Fix: Changed condition to handle all `functionCall` parts, defaulting `args` to `{}` when missing, ensuring opencode's `state.input` always receives a valid record

- **Auth headers aligned with official Gemini CLI** - Updated authentication headers to match the official Antigravity/Gemini CLI behavior, reducing "account ineligible" errors and potential bans ([#178](https://github.com/NoeFabris/opencode-antigravity-auth/issues/178))
  - `GEMINI_CLI_HEADERS["User-Agent"]`: `9.15.1` → `10.3.0`
  - `GEMINI_CLI_HEADERS["X-Goog-Api-Client"]`: `gl-node/22.17.0` → `gl-node/22.18.0`
  - `ANTIGRAVITY_HEADERS["User-Agent"]`: Updated to full Chrome/Electron user agent string
  - Token exchange now includes `Accept`, `Accept-Encoding`, `User-Agent`, `X-Goog-Api-Client` headers
  - Userinfo fetch now includes `User-Agent`, `X-Goog-Api-Client` headers
  - `fetchProjectID` now uses centralized constants instead of hardcoded strings

- **`quiet_mode` now properly suppresses all toast notifications** - Fixed `quiet_mode: true` in `antigravity.json` not suppressing "Status dialog dismissed" and other toast notifications ([#207](https://github.com/NoeFabris/opencode-antigravity-auth/issues/207))
  - Root cause: The `showToast` helper function didn't check `quietMode`, and only some call sites had manual `!quietMode &&` guards
  - Fix: Moved `quietMode` check inside `showToast` helper so all toasts are automatically suppressed when `quiet_mode: true`

### Removed

- **Removed automatic `googleSearch` injection** - Previously attempted to inject `{ googleSearch: {} }` into all Gemini requests, which never worked due to API limitations. Now uses the explicit tool approach instead

## [1.3.0] - Previous Release

See [releases](https://github.com/NoeFabris/opencode-antigravity-auth/releases) for previous versions.
