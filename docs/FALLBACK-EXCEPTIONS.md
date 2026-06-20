# Fallback Exceptions & Coding Principles

## The Core Principle
**Fail loudly. No silent swallowing of errors. No hidden fallbacks.**

When code fails, let it stop. We capture all the context we can, troubleshoot, and turn around a fix quickly. Silent failures and hidden fallbacks mask the root cause, create zombie states, and degrade system predictability.

## The Exception Rule
If a fallback or error-swallowing mechanism is genuinely intended and required by the architecture:
1. It MUST have an explicit comment in the source code explaining that it is an intended fallback.
2. It MUST be documented in this file (`docs/FALLBACK-EXCEPTIONS.md`).

**If a fallback is NOT mentioned in this file, it is NOT an official fallback.** It is considered a violation of the coding principles and must be removed in favor of failing loudly.

---

## Approved Exceptions

*(Add approved fallbacks here as they are discovered and validated by the human partner)*
