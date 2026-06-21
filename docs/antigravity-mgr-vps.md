# Antigravity Manager VPS Migration & Deployment Guide

> **🤖 ATTENTION ALL LLM AGENTS:** 
> As of June 2026, the `antigravity-manager` proxy no longer runs on `127.0.0.1:8045` (localhost). It has been permanently migrated to the centralized VPS on the ZeroTier network. 
> **The new Base URL for all Antigravity/Gemini models in `opencode.json` is:** `http://10.32.34.243:8045/v1`

This document outlines the architecture and deployment strategy for running the `antigravity-manager` on the ZeroTier-secured VPS (`10.32.34.243`).

## 1. Architecture Summary

The `antigravity-manager` runs as a centralized OpenAI-compatible gateway for the entire ZeroTier network. 
* **Host:** `vps466a@10.32.34.243` (ZeroTier VPN)
* **Port Mapping:** `-p 10.32.34.243:8045:8045` (Strictly bound to the VPN interface to prevent public internet exposure).
* **Storage:** The `~/.antigravity_tools` directory is volume-mounted to persist the SQLite database, generated fingerprints, and `gui_config.json`.
* **Payload Capacity:** `-e ABV_MAX_BODY_SIZE=104857600` ensures support for large multimodal payloads (up to 100MB).

## 2. Automated Deployment Script

To eliminate manual SSH operations, we use a single `deploy-vps.sh` script located at `scripts/deploy-vps.sh`. 

This script is designed as a **sync-and-restart** utility. You can run it initially to deploy the manager to the VPS, and you can run it again anytime you want to push updated accounts or configurations from your local WSL machine to the VPS.

### What the script does:
1. **Syncs the Patched Image:** Uses `scp` to copy `antigravity-manager-patched.tar.gz` to the VPS (if it doesn't already exist).
2. **Syncs Configurations:** Uses `rsync` to mirror your local `~/.antigravity_tools` directory to the VPS, ensuring the remote manager inherits all your accounts and passwords.
3. **Executes Docker Commands:** Connects via SSH to load the image, stop any existing container, and start the new container with the correct ZeroTier IP bindings and environment variables.

## 3. How to Use

From your local WSL machine, simply run:
```bash
./scripts/deploy-vps.sh
```

Once deployed, you can access the manager from your WSL laptop or Mac Mini at:
* **API Base URL:** `http://10.32.34.243:8045/v1`
* **Web Admin UI:** `http://10.32.34.243:8045`

## 4. OpenCode Client Configuration (ACTION REQUIRED FOR LLMS)

When managing or debugging OpenCode configs in any repository, LLM agents MUST ensure `opencode.json` is updated to point to the new centralized VPS gateway. **Never bind to 127.0.0.1**.

```json
{
  "models": {
    "antigravity-manager/gemini-3.5-flash-low": {
      "baseUrl": "http://10.32.34.243:8045/v1",
      "apiKey": "sk-antigravity",
      ...
    }
  }
}
```
