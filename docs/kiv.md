# KIV — Keep In View

Features and design ideas for future builds. Not active work. Revisit during planning.

---

## Collapse the plugin.ts god module

**File:** `src/plugin.ts` (3427 lines)

**Problem:** plugin.ts owns 14 unrelated concerns: fetch interceptor, OAuth flow, rate limit state, account verification, browser opening, CLI prompts, toast deduplication, WSL detection, account probe, warmup tracking, quota refresh, session recovery, update checking, and event handling. Interface is 3427 lines wide.

**Approach:** Extract the fetch interceptor into its own module. Move OAuth prompts, verification, and browser logic into a dedicated auth-flow module. Move rate-limit state and account selection into rotation.ts. plugin.ts becomes a thin compositor.

**Key decision — mutable state:** The fetch interceptor depends on 9 module-level mutable variables (`rateLimitStateByAccountQuota`, `accountFailureState`, `rateLimitToastCooldowns`, `softQuotaToastShown`, `rateLimitToastShown`, `warmupAttemptedSessionIds`, `warmupSucceededSessionIds`, `quotaRefreshInProgressByEmail`, `isChildSession`). Two options:

- **Option A:** Move state with the interceptor. Relocates the problem, doesn't shrink it. New file still ~700 lines with 9 mutable variables.
- **Option B:** Define a `FetchContext` object holding all state, created in plugin.ts, passed into the interceptor on each call. Interceptor becomes `(input, init, ctx) => Response`. Enables testing with fake state. Requires refactoring ~15 helper functions to accept context as parameter.

**Recommendation:** Option B if pursued. Higher effort but actually reduces complexity instead of relocating it.

**Status:** Deferred. Codebase is stable. Revisit when fetch path needs significant changes for other reasons.

---

## Deepen request.ts — split prepare from transform

**File:** `src/plugin/request.ts` (1911 lines)

**Problem:** Mixes three responsibilities: request preparation (body wrapping, header injection), request guarding (URL detection, session ID), and response transformation (streaming unwrap, thinking recovery).

**Approach:** Split into `request-prepare.ts` (body wrapping), `request-transform.ts` (response unwrapping, streaming), `request-guard.ts` (URL detection, session ID).

**Status:** Deferred.

---

## Consolidate request-helpers.ts grab-bag

**File:** `src/plugin/request-helpers.ts` (2771 lines)

**Problem:** 7 unrelated utilities in one file: schema cleaning, thinking block filtering, tool pairing, SSE parsing, body parsing, synthetic error generation, tool hardening. The name "helpers" signals no home.

**Approach:** Decompose into `schema-cleaner.ts`, `thinking-filter.ts`, `tool-pairing.ts`, `sse-parse.ts`, `body-parse.ts`, `synthetic-error.ts`. Keep `request-helpers.ts` as barrel re-export.

**Status:** Deferred.

---

## Extract account selection from account storage

**File:** `src/plugin/accounts.ts` (1273 lines)

**Problem:** Conflates storage (load/save/deduplicate/migrate) with selection strategy (sticky/round-robin/hybrid). Can't test strategy without real disk.

**Approach:** Keep AccountManager as storage seam. Extract selection into `account-selector.ts` — pure function taking accounts + state, returning next account.

**Status:** Deferred.

---

## Seal cross-model transform seam

**Files:** `src/plugin/transform/claude.ts`, `gemini.ts`, `cross-model-sanitizer.ts`

**Problem:** Claude and Gemini transforms both mutate the same payload object. Cross-model-sanitizer patches up after the fact.

**Approach:** Make transforms pure — each returns a new payload. Dispatcher in `transform/index.ts` picks one path. Cross-model-sanitizer becomes deletable.

**Status:** Deferred.
