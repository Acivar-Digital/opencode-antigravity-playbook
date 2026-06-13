# Antigravity Plugin Documentation

Welcome to the documentation for the `opencode-antigravity-auth` plugin. These documents contain deep dives into the plugin's architecture, configurations, and operational playbooks.

## Directory Index

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**  
  Details the internal design, request interception flows, fingerprint generation, and component structure of the proxy engine.

- **[CONFIGURATION.md](./CONFIGURATION.md)**  
  Comprehensive guide on all configuration keys, environment variables, scheduling modes, and user/project level `antigravity.json` setups.

- **[MULTI-ACCOUNT.md](./MULTI-ACCOUNT.md)**  
  Operational guide to configuring round-robin, performance-first, or cache-first multi-account routing, handling 429/500/503 errors, and managing Google API quota limits.

- **[ANTIGRAVITY_API_SPEC.md](./ANTIGRAVITY_API_SPEC.md)**  
  Specifications for the underlying Google Antigravity Internal API schemas, including endpoints, header injection (Electron vs Go CLI styles), and payload translation.

- **[MODEL-VARIANTS.md](./MODEL-VARIANTS.md)**  
  Details on model variant mappings, extended thinking mode budget tokens, and intelligent routing for Claude 3.5/3.7/4.x and Gemini 1.5/2.0/3.0/3.1 series models.

- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**  
  The ultimate playbook for diagnosing HTTP 400/401/403/429/5xx errors, session recovery, OAuth issues, and fixing complex MCP tool schema validation rejections.

- **[RISK-AND-CHALLENGES.md](./RISK-AND-CHALLENGES.md)**  
  Important disclaimers regarding technical limitations, API reverse-engineering risks, and Terms of Service considerations.
