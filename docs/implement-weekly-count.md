# Compute-Based Quota Model Implementation Plan

## Goal
Implement a dynamic compute-based tracking and rotation system for Google Antigravity OAuth accounts to handle the June 18, 2026 compute quota model.

## Core Pillars
1. **Dynamic Cost Heuristics**: Estimate prompt complexity, history weight, and reasoning depth before request execution.
2. **Double Rolling Consumption Windows**: Track a local 5-hour rolling workspace usage window and a 7-day infrastructure rolling ceiling.
3. **Storage V5 Migration**: Persist local usage history and compute budget snapshots per account.
4. **Weighted Multi-Account Rotation**: Integrate estimated compute cost into the hybrid account rotation priority score.

## Implementation Blueprint
- **`src/plugin/compute.ts`**: Implements token count estimation, reasoning cost multipliers, and complexity classification.
- **`src/plugin/quota.ts`**: Integrates `ComputeTracker` which manages the 5-hour and 7-day rolling compute calculations.
- **`src/plugin/storage.ts`**: Handles migration to Storage V5 schema to persist compute usage snapshots.
- **`src/plugin/rotation.ts`**: Updates token bucket and hybrid scoring to consume variable compute costs.
- **`src/plugin/request.ts`**: Runs the pre-request cost estimator.
- **`src/plugin.ts`**: Feeds real usage metadata back to the tracker upon request completion and triggers rotation on exhaustion.
- **`src/plugin/config/schema.ts`**: Adds configuration parameters for compute budgets.
