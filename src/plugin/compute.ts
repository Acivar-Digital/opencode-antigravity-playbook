/**
 * Compute Estimation Engine
 * 
 * Estimates the compute unit cost of outgoing requests based on prompt complexity,
 * history length, reasoning configurations, and model type.
 */
import { isClaudeThinkingModel, isGemini3Model } from "./transform/index";

export interface ComputeCostEstimate {
  estimatedCost: number; // In abstract compute units
  promptTokenEstimate: number;
  costTier: "light" | "medium" | "heavy";
}

/**
 * Fast character-based token count estimator.
 * Uses a standard ~4 characters per token proxy.
 */
export function estimateTokenCount(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimates request compute cost based on prompt content, history, and reasoning.
 */
export function estimateRequestCost(
  requestBodyText: string,
  modelName: string,
  reasoningMultiplier = 2
): ComputeCostEstimate {
  let promptTokenEstimate = 0;
  let historyMessageCount = 0;
  let hasTools = false;
  let isReasoning = false;

  try {
    const body = JSON.parse(requestBodyText);
    const req = typeof body.request === "object" && body.request !== null ? body.request : body;

    // Estimate prompt tokens from contents or messages
    const contents = req.contents || req.messages;
    if (Array.isArray(contents)) {
      historyMessageCount = contents.length;
      for (const item of contents) {
        if (item && typeof item === "object") {
          // Check parts
          if (Array.isArray(item.parts)) {
            for (const part of item.parts) {
              if (part && typeof part === "object") {
                if (typeof part.text === "string") {
                  promptTokenEstimate += estimateTokenCount(part.text);
                }
                // Check if part holds inline data (like images)
                if (part.inlineData) {
                  promptTokenEstimate += 1000; // Flat penalty for multimodal payload
                }
              }
            }
          }
          // Claude messages format check
          if (typeof item.content === "string") {
            promptTokenEstimate += estimateTokenCount(item.content);
          } else if (Array.isArray(item.content)) {
            for (const sub of item.content) {
              if (sub && typeof sub === "object") {
                if (typeof sub.text === "string") {
                  promptTokenEstimate += estimateTokenCount(sub.text);
                }
              }
            }
          }
        }
      }
    } else {
      // Fallback: estimate from raw body string length
      promptTokenEstimate = estimateTokenCount(requestBodyText);
    }

    // Check for tools
    if (req.tools || req.toolsConfig) {
      hasTools = true;
    }

    // Check if thinking / reasoning is requested
    const isClaudeThinking = isClaudeThinkingModel(modelName);
    const isGemini3 = isGemini3Model(modelName);
    const generationConfig = req.generationConfig;
    
    if (isClaudeThinking) {
      isReasoning = true;
    } else if (isGemini3 && generationConfig?.thinkingConfig) {
      const mode = generationConfig.thinkingConfig.thinkingMode;
      if (mode && mode !== "THINKING_DISABLED") {
        isReasoning = true;
      }
    }
  } catch {
    // If JSON parsing fails, fall back to simple string length estimation
    promptTokenEstimate = estimateTokenCount(requestBodyText);
  }

  // Calculate abstract compute units (CU)
  // Base cost is 1 CU per 1,000 estimated input tokens
  let baseCost = Math.max(1, Math.ceil(promptTokenEstimate / 1000));

  // Multipliers
  // Multi-turn context compounding increases processing effort
  if (historyMessageCount > 10) {
    baseCost *= 1.5;
  } else if (historyMessageCount > 25) {
    baseCost *= 2.0;
  }

  // Tooling/agent loop penalty
  if (hasTools) {
    baseCost *= 1.25;
  }

  // Reasoning penalty (e.g. Gemini 3.5 Flash self-correction/thought preservation)
  if (isReasoning) {
    baseCost *= reasoningMultiplier;
  }

  const estimatedCost = Math.ceil(baseCost);

  // Classify cost tier
  let costTier: "light" | "medium" | "heavy" = "light";
  if (estimatedCost >= 50) {
    costTier = "heavy";
  } else if (estimatedCost >= 15) {
    costTier = "medium";
  }

  return {
    estimatedCost,
    promptTokenEstimate,
    costTier,
  };
}

export interface ComputeUsageEntry {
  timestamp: number;
  cost: number;
  model: string;
  isReasoning: boolean;
}

/**
 * Tracks and sums historical compute usage entries over specified rolling windows.
 */
export class ComputeTracker {
  private usageLog: Map<number, ComputeUsageEntry[]> = new Map();

  constructor(initialLogs: Record<number, ComputeUsageEntry[]> = {}) {
    for (const [idxStr, logs] of Object.entries(initialLogs)) {
      const idx = parseInt(idxStr, 10);
      if (!isNaN(idx)) {
        this.usageLog.set(idx, logs);
      }
    }
  }

  getLogs(accountIndex: number): ComputeUsageEntry[] {
    return this.usageLog.get(accountIndex) || [];
  }

  setLogs(accountIndex: number, logs: ComputeUsageEntry[]): void {
    this.usageLog.set(accountIndex, logs);
  }

  /**
   * Adds a new compute usage record and prunes old logs.
   */
  recordUsage(accountIndex: number, cost: number, model: string, isReasoning: boolean): ComputeUsageEntry[] {
    const now = Date.now();
    const currentLogs = this.getLogs(accountIndex);
    
    const newEntry: ComputeUsageEntry = {
      timestamp: now,
      cost,
      model,
      isReasoning
    };

    const updatedLogs = [...currentLogs, newEntry];
    
    // Prune entries older than 7 days (7 * 24 * 60 * 60 * 1000 ms)
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    let prunedLogs = updatedLogs.filter(entry => entry.timestamp >= sevenDaysAgo);

    // Hard limit log size to prevent unbounded file/memory growth (e.g., last 200 entries)
    if (prunedLogs.length > 200) {
      prunedLogs = prunedLogs.slice(-200);
    }

    this.usageLog.set(accountIndex, prunedLogs);
    return prunedLogs;
  }

  /**
   * Calculates rolling window totals.
   */
  getRollingTotals(accountIndex: number): { fiveHourTotal: number; weeklyTotal: number } {
    const now = Date.now();
    const logs = this.getLogs(accountIndex);
    const fiveHoursAgo = now - 5 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    let fiveHourTotal = 0;
    let weeklyTotal = 0;

    for (const entry of logs) {
      if (entry.timestamp >= fiveHoursAgo) {
        fiveHourTotal += entry.cost;
      }
      if (entry.timestamp >= sevenDaysAgo) {
        weeklyTotal += entry.cost;
      }
    }

    return { fiveHourTotal, weeklyTotal };
  }
}

// Global compute tracker singleton
let globalComputeTracker: ComputeTracker | null = null;

export function getComputeTracker(): ComputeTracker {
  if (!globalComputeTracker) {
    globalComputeTracker = new ComputeTracker();
  }
  return globalComputeTracker;
}
