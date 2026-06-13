# Right-Way Test Guide

This document outlines the mandatory "right-way" process for testing and verifying any code changes made to the `opencode-antigravity-auth` plugin. Any AI agent or developer modifying the codebase must follow this sequence strictly before marking a task as complete.

---

## The Verification Loop

Whenever you implement a code change, you must complete all five steps in this loop:

### 1. Run Unit Tests
Ensure that the existing unit test suite compiles and runs successfully:
```bash
npm run test
```
*Do not proceed if any unit tests fail.*

### 2. Build the Production Codebase
Compile the TypeScript source code to generate production artifacts:
```bash
npm run build
```
Verify that the `tsc` compiler exits with code `0` and generates the `dist/` directory without issues.

### 3. Deploy/Inject to the OpenCode Package Cache
Because OpenCode executes using its cached packages, you must copy the newly compiled production build into the active package location:
```bash
cp -r dist/* ~/.cache/opencode/packages/opencode-antigravity-auth@latest/node_modules/opencode-antigravity-auth/dist/
```

### 4. Execute a Live CLI Test Request
Trigger a real request through OpenCode to verify integration and authentication behavior. Use the `--print-logs` flag and a specific model to monitor output:
```bash
/home/yapilwsl/.opencode/bin/opencode run "hello, who are you? respond in 3 words." --model "google/antigravity-gemini-3-flash" --print-logs
```

### 5. Verify CLI Output and Server Logs
Verify that:
- The command succeeds and returns the actual text generation response from the model.
- The output logs (printed to stderr via `--print-logs`) show that the request was processed and intercepted by the `opencode-antigravity-auth` plugin.
- No unexpected errors (like `EACCES` permission blocks, `ProviderModelNotFoundError`, or auth/refresh token failures) occur during the execution.
