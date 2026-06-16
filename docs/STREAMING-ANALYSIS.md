# Streaming Response Analysis: Antigravity-Manager vs Our Plugin

## Problem Statement

After code changes, Gemini 3 and 3.1 models caused "data overflooding the template" — the TUI received malformed SSE data it couldn't parse, causing display issues and session failures.

## Root Cause

**The SSE `data:` line format was wrong.** Our plugin was preserving the `{"response": ...}` wrapper from the upstream API's SSE response, but OpenCode's Google provider (`@ai-sdk/google`) expects the **inner response object directly** — without the wrapper.

## The Fix (Applied)

Changed both `transformSseLine` and `transformStreamingPayload` in `src/plugin/core/streaming/transformer.ts` to **unwrap** the response wrapper, matching what the Antigravity-Manager does and what the Google provider expects.

### Before (broken):
```typescript
return `data: ${JSON.stringify({ ...parsed, response: transformed })}`;
// Output: data: {"response": {"candidates": [...], "usageMetadata": {...}}}
```

### After (fixed):
```typescript
return `data: ${JSON.stringify(transformed)}`;
// Output: data: {"candidates": [...], "usageMetadata": {...}}
```

## Evidence

### 1. @ai-sdk/google chunkSchema

The Google provider's SSE parser expects this schema for each `data:` line:
```javascript
// From @ai-sdk/google dist/index.js line 2464-2484
var chunkSchema = lazySchema(() => zodSchema(z.object({
  candidates: z.array(z.object({
    content: getContentSchema().nullish(),
    finishReason: z.string().nullish(),
    // ...
  })).nullish(),
  usageMetadata: usageSchema.nullish(),
  // ...
})));
```

**No `response` wrapper.** The schema expects `candidates` and `usageMetadata` at the top level.

### 2. Antigravity-Manager v4.2.2

The Antigravity-Manager explicitly **unwraps** the response in its streaming handler (`handlers/gemini.rs` lines 450-456):

```rust
// Unwrap v1internal response wrapper
if let Some(inner) = json.get_mut("response").map(|v| v.take()) {
    let new_line = format!("data: {}\n\n", serde_json::to_string(&inner).unwrap_or_default());
    yield Ok::<Bytes, String>(Bytes::from(new_line));
} else {
    yield Ok::<Bytes, String>(Bytes::from(format!("data: {}\n\n", serde_json::to_string(&json).unwrap_or_default())));
}
```

The `unwrap_response` function in `mappers/gemini/wrapper.rs` (line 678-680) does the same:
```rust
pub fn unwrap_response(response: &Value) -> Value {
    response.get("response").unwrap_or(response).clone()
}
```

### 3. Non-streaming path already worked

Our plugin's non-streaming path (request.ts line 1862) already returned the inner response directly:
```typescript
return new Response(JSON.stringify(transformed), init);
// where transformed = transformThinkingParts(effectiveBody.response)
```

This worked fine because it never had the wrapper. The streaming path should do the same.

## Architecture Difference: Proxy vs Interceptor

**Antigravity-Manager** is a **proxy** — it sits between the client and the API:
```
Client → Proxy → Upstream API
       ← Proxy ← (SSE with wrapper)
       ← (SSE without wrapper, proxy unwraps)
```

**Our plugin** is a **fetch interceptor** — it sits inside OpenCode:
```
OpenCode → Plugin → Upstream API
        ← Plugin ← (SSE with wrapper)
        ← (SSE without wrapper, plugin must unwrap)
```

In both cases, the client (OpenCode) expects unwrapped SSE. The Antigravity-Manager unwraps at the proxy level; our plugin must unwrap at the interceptor level.

## Complete SSE Flow in Our Plugin

### Upstream API sends:
```
data: {"response": {"candidates": [{"content": {"parts": [{"text": "Hello"}, {"thought": true, "text: "..."}]}, "finishReason": "STOP"}], "usageMetadata": {"totalTokenCount": 100}}, "traceId": "abc"}
```

### Our plugin receives and processes:
1. **Parse**: Extract JSON from `data: {...}`
2. **Unwrap**: Extract `parsed.response` (the inner response object)
3. **Cache signatures**: Extract `thoughtSignature` from thinking parts
4. **Deduplicate thinking**: Track sent thinking text, extract deltas
5. **Transform thinking**: Convert `thought: true` → `type: "reasoning"`
6. **Output**: `data: ${JSON.stringify(transformed)}` (unwrapped)

### OpenCode's Google provider receives:
```
data: {"candidates": [{"content": {"parts": [{"text": "Hello"}, {"type": "reasoning", "text": "..."}]}, "finishReason": "STOP"}], "usageMetadata": {"totalTokenCount": 100}}
```

The provider's `chunkSchema` validates this against `{candidates: [...], usageMetadata: {...}}` — matches perfectly.

## Key Differences from Antigravity-Manager

| Aspect | Antigravity-Manager | Our Plugin |
|--------|-------------------|------------|
| Architecture | Proxy (separate process) | Fetch interceptor (in-process) |
| SSE wrapper handling | Unwraps `response` | Now unwraps (was broken: preserved) |
| Thinking deduplication | None (passes through) | Delta extraction via `sentBuffer` |
| Thinking transformation | None (passes through) | `thought: true` → `type: "reasoning"` |
| Signature caching | Per-chunk in stream handler | Per-chunk in `cacheThinkingSignaturesFromResponse` |
| Model name resolution | Passes through with alias mapping | Adds tier suffix (`-low`/`-high`) for Pro models |
| Request wrapping | Full v1internal wrap with project, requestId, userAgent | Wraps with project, model, request |
| Error recovery | Retry with account rotation | Retry with account rotation |

## Files Changed

### `src/plugin/core/streaming/transformer.ts`
- `transformStreamingPayload()` (line 50): Changed from `{ ...parsed, response: transformed }` to just `transformed`
- `transformSseLine()` (line 220): Same change

### `src/plugin/request.test.ts`
- Added test: "unwraps v1internal response wrapper in streaming data"
- Added test: "unwraps v1internal response wrapper in multi-line payload"

## Verification

All 1005 tests pass. The streaming tests specifically verify:
1. Input with `{"response": {"candidates": [...]}}` → output has `candidates` at top level
2. Output does NOT contain `"response"` key
3. Output does NOT contain `traceId` (which was in the wrapper, not the inner response)

## Handling of `thought: true` Parts

### Our Plugin
- `deduplicateThinkingText()` in `transformer.ts` performs **delta extraction**: tracks what thinking text has already been sent via `sentBuffer` and only sends new text
- Converts `thought: true` parts to deltas: `{ ...p, text: delta, thinking: delta }`
- Non-thinking text parts pass through unchanged

### Antigravity-Manager
- Collector merges **adjacent text parts** (lines 96-111): if the last part was a plain text part and the current part is also plain text (no `thought` key), they get merged into a single text part
- **Thinking parts are NOT transformed** — they pass through as-is with `thought: true` preserved
- **No delta thinking extraction** in streaming mode — the full thinking text in each SSE chunk is passed through
- Non-streaming mode uses `collect_stream_to_json` which accumulates all parts

### Key Difference for Fix
Our delta extraction of thinking text means that in streaming mode, each SSE event only gets the **new** thinking text since the last event. This is correct for OpenCode, which expects incremental content.

The Antigravity-Manager doesn't do this thinking-specific delta extraction — it just merges adjacent text parts. Our approach is more precise for thinking blocks.

## Lessons Learned

1. **Always verify the expected output format** — don't assume the wrapper should be preserved just because the API sends it
2. **Study the consumer's parser** — the `@ai-sdk/google` chunkSchema clearly shows what format is expected
3. **Reference working implementations** — the Antigravity-Manager's approach of unwrapping was the correct one
4. **Architecture matters** — a proxy can unwrap at the boundary; an interceptor must do the same
5. **Test with realistic data** — the new tests use the actual `{"response": {...}}` wrapper format from the upstream API
