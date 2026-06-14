import { describe, expect, it } from "vitest";
import { estimateTokenCount, estimateRequestCost, ComputeTracker } from "./compute.js";

describe("estimateTokenCount", () => {
  it("returns 0 for empty strings", () => {
    expect(estimateTokenCount("")).toBe(0);
    expect(estimateTokenCount(null)).toBe(0);
    expect(estimateTokenCount(undefined)).toBe(0);
  });

  it("calculates estimated token count using 4 characters per token proxy", () => {
    expect(estimateTokenCount("abcd")).toBe(1);
    expect(estimateTokenCount("abcdefgh")).toBe(2);
    expect(estimateTokenCount("a".repeat(100))).toBe(25);
  });
});

describe("estimateRequestCost", () => {
  it("calculates light cost for simple prompt", () => {
    const body = JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] });
    const result = estimateRequestCost(body, "gemini-3-flash");
    expect(result.estimatedCost).toBe(1);
    expect(result.costTier).toBe("light");
  });

  it("applies reasoning multiplier for reasoning models", () => {
    const body = JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] });
    const result = estimateRequestCost(body, "claude-opus-4-6-thinking", 3);
    // Base cost is 1, multiplied by reasoning multiplier 3
    expect(result.estimatedCost).toBe(3);
  });

  it("applies penalties for history and tools", () => {
    // Generate body with 15 turns
    const contents = Array.from({ length: 15 }, () => ({ parts: [{ text: "hello" }] }));
    const body = JSON.stringify({ contents, tools: [{ functionDeclarations: [] }] });
    const result = estimateRequestCost(body, "gemini-3-pro");
    // Base cost: 1 CU. Multipliers: history (1.5) * tools (1.25) = 1.875 -> rounded up to 2
    expect(result.estimatedCost).toBe(2);
  });
});

describe("ComputeTracker", () => {
  it("tracks rolling window totals and prunes logs", () => {
    const tracker = new ComputeTracker();
    const accountIndex = 0;

    // Record some usage
    tracker.recordUsage(accountIndex, 10, "gemini-3-flash", false);
    tracker.recordUsage(accountIndex, 25, "gemini-3-flash", true);

    const totals = tracker.getRollingTotals(accountIndex);
    expect(totals.fiveHourTotal).toBe(35);
    expect(totals.weeklyTotal).toBe(35);

    // Verify logs retrieval
    const logs = tracker.getLogs(accountIndex);
    expect(logs.length).toBe(2);
  });
});
