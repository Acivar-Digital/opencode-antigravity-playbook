# Local Codebase Indexing Implementation via MCPMart

This document details the configuration, integration, and patching steps required to enable local semantic search and codebase indexing using `opencode-codebase-index` and the local `mcpmart` API gateway.

## 1. Environment & Endpoints
*   **Machine Role**: Development WSL (`yapilwsl`) connecting to VPS (`vps466a` at `10.32.34.243`)
*   **MCPMart Gateway URL**: `http://10.32.34.243:18000`
*   **Embeddings Endpoint**: `http://10.32.34.243:18000/v1/openai/embeddings`
*   **Embedding Model**: `gemini-embedding-2` (outputs 768 dimensions when `dimensions: 768` is specified in the request body)
*   **Authorization**: `Bearer localfreegemini`

---

## 2. Configuration Files

### A. Project Config (`opencode.json`)
The plugin `"opencode-codebase-index"` must be registered in the project's root `opencode.json` configuration file:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "skills": {
    "paths": [
      ".agents/skills"
    ]
  },
  "plugin": [
    "opencode-codebase-index"
  ]
}
```

### B. Indexer Config (`.opencode/codebase-index.json`)
This specifies how the indexer connects to the custom embeddings provider:
```json
{
  "embeddingProvider": "custom",
  "customProvider": {
    "baseUrl": "http://10.32.34.243:18000/v1/openai",
    "model": "gemini-embedding-2",
    "dimensions": 768,
    "apiKey": "localfreegemini",
    "maxTokens": 8192,
    "timeoutMs": 30000,
    "concurrency": 3,
    "maxBatchSize": 64
  }
}
```

---

## 3. Matryoshka Dimensions Patch
The `opencode-codebase-index` plugin does not send the `dimensions` parameter to custom embedding providers by default. This causes the API to return the default model dimensionality (3072D), triggering a validation error because the indexer expects 768D.

The patch intercepts the request body construction and adds `dimensions: this.modelInfo.dimensions` to the custom provider's fetch call.

### Match Block (JS / ESM & CJS)
```javascript
      response = await fetch(fullUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.modelInfo.model,
          input: texts
        }),
```

### Target Patched Block
```javascript
      response = await fetch(fullUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.modelInfo.model,
          input: texts,
          dimensions: this.modelInfo.dimensions
        }),
```

This patch must be applied to the following files in `node_modules/opencode-codebase-index/dist/`:
*   `index.js`
*   `cli.js`
*   `index.cjs`
*   `cli.cjs`
