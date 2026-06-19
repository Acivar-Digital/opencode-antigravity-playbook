# Plugin Testing Guidelines

You are implementing a code change or verifying issues in the `opencode-antigravity-auth` plugin. To ensure code quality, compliance, and correctness, you must read and adhere strictly to the verification procedures detailed in the "right-way" test document.

## Mandatory Test Directive
Before considering any task complete, you MUST execute the steps described in `test/right-way-test.md` in the following sequence:

1. **Unit Verification:** Run `npm run test` to verify all standard unit tests pass.
2. **Compilation Verification:** Run `npm run build` to compile the production build.
3. **Cache Injection:** Run the copy command to deploy your build directly to the live OpenCode packages cache at `~/.cache/opencode/packages/opencode-antigravity-auth@latest/node_modules/opencode-antigravity-auth/dist/`.
4. **Live Execution:** Trigger a test request via the `opencode` binary using `--print-logs` and target `google/antigravity-gemini-3-flash` to confirm real request interception, authorization, and response generation succeed.
5. **Log Inspection:** Read the logs outputted to verify correct routing and no failures.

Refer to `test/right-way-test.md` for the exact code snippets and commands. Do not bypass this flow under any circumstances.
