import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeSearch } from "./search";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSearchResponse(
  text: string,
  opts: {
    searchQueries?: string[];
    groundingChunks?: Array<{ title: string; uri: string }>;
    urlMetadata?: Array<{ retrieved_url: string; url_retrieval_status: string }>;
  } = {},
) {
  return {
    response: {
      candidates: [
        {
          content: { role: "model", parts: [{ text }] },
          finishReason: "STOP",
          groundingMetadata: {
            webSearchQueries: opts.searchQueries ?? [],
            groundingChunks: (opts.groundingChunks ?? []).map((c) => ({
              web: { uri: c.uri, title: c.title },
            })),
          },
          urlContextMetadata: {
            url_metadata: opts.urlMetadata ?? [],
          },
        },
      ],
    },
  };
}

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

// ─── executeSearch ────────────────────────────────────────────────────────────

describe("executeSearch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch(makeSearchResponse("Result text")));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns formatted search result text on success", async () => {
    vi.stubGlobal("fetch", mockFetch(makeSearchResponse("The answer is 42.")));
    const result = await executeSearch(
      { query: "what is 42?" },
      "test-token",
      "test-project",
    );
    expect(result).toContain("The answer is 42.");
    expect(result).toContain("## Search Results");
  });

  it("includes sources when grounding chunks are present", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(
        makeSearchResponse("Some answer", {
          groundingChunks: [{ title: "Example Site", uri: "https://example.com" }],
        }),
      ),
    );
    const result = await executeSearch(
      { query: "test query" },
      "tok",
      "proj",
    );
    expect(result).toContain("### Sources");
    expect(result).toContain("Example Site");
    expect(result).toContain("https://example.com");
  });

  it("includes search queries section when queries are present", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(
        makeSearchResponse("answer", { searchQueries: ["my search query"] }),
      ),
    );
    const result = await executeSearch({ query: "my search query" }, "tok", "proj");
    expect(result).toContain("### Search Queries Used");
    expect(result).toContain('"my search query"');
  });

  it("includes URL retrieval section for url context results", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(
        makeSearchResponse("content", {
          urlMetadata: [
            { retrieved_url: "https://docs.example.com", url_retrieval_status: "URL_RETRIEVAL_STATUS_SUCCESS" },
          ],
        }),
      ),
    );
    const result = await executeSearch(
      { query: "check docs", urls: ["https://docs.example.com"] },
      "tok",
      "proj",
    );
    expect(result).toContain("### URLs Retrieved");
    expect(result).toContain("https://docs.example.com");
    expect(result).toContain("✓");
  });

  it("marks failed URL retrievals with ✗", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(
        makeSearchResponse("content", {
          urlMetadata: [
            { retrieved_url: "https://broken.example.com", url_retrieval_status: "URL_RETRIEVAL_STATUS_ERROR" },
          ],
        }),
      ),
    );
    const result = await executeSearch(
      { query: "q", urls: ["https://broken.example.com"] },
      "tok",
      "proj",
    );
    expect(result).toContain("✗");
  });

  it("returns error message on non-OK HTTP response", async () => {
    vi.stubGlobal("fetch", mockFetch({ error: "bad request" }, 400));
    const result = await executeSearch({ query: "test" }, "tok", "proj");
    expect(result).toContain("## Search Error");
    expect(result).toContain("400");
  });

  it("returns error message when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network failure")),
    );
    const result = await executeSearch({ query: "test" }, "tok", "proj");
    expect(result).toContain("## Search Error");
    expect(result).toContain("Network failure");
  });

  it("returns error text when response has no candidates", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ response: { candidates: [] } }),
    );
    const result = await executeSearch({ query: "q" }, "tok", "proj");
    // Empty candidates — result should have section header but empty body
    expect(result).toContain("## Search Results");
  });

  it("returns error when top-level error field is present", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        error: { code: 403, message: "Quota exceeded", status: "RESOURCE_EXHAUSTED" },
      }),
    );
    const result = await executeSearch({ query: "q" }, "tok", "proj");
    expect(result).toContain("Quota exceeded");
  });

  it("includes multiple text parts concatenated", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        response: {
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Part one." }, { text: "Part two." }],
              },
              finishReason: "STOP",
              groundingMetadata: {},
            },
          ],
        },
      }),
    );
    const result = await executeSearch({ query: "multi" }, "tok", "proj");
    expect(result).toContain("Part one.");
    expect(result).toContain("Part two.");
  });

  it("sends Authorization header with the provided access token", async () => {
    const fetchSpy = mockFetch(makeSearchResponse("ok"));
    vi.stubGlobal("fetch", fetchSpy);
    await executeSearch({ query: "q" }, "my-access-token", "proj");
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer my-access-token",
    );
  });

  it("passes an AbortSignal when provided", async () => {
    const fetchSpy = mockFetch(makeSearchResponse("ok"));
    vi.stubGlobal("fetch", fetchSpy);
    const controller = new AbortController();
    await executeSearch({ query: "q" }, "tok", "proj", controller.signal);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });
});
