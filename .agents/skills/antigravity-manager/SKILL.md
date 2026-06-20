# Skill: antigravity-manager

# Antigravity Manager Troubleshooting

Use this skill when the user faces startup errors, permission issues, missing accounts, or password problems with the `antigravity-manager` Docker container.

## Mental Model

The `antigravity-manager` runs inside a Docker container (default port `8045`) and exposes both a Web Admin UI and an OpenAI-compatible REST API. It binds the host directory `/home/yapilwsl/.antigravity_tools` to `/root/.antigravity_tools` in the container to persist configurations, log databases, and credentials. 

If host directory permissions drift or the database starts empty, the manager fails to route requests.

## Diagnostic Checklist

1. **Check Container Status**:
   ```bash
   docker ps -a | grep antigravity-manager
   ```
2. **Inspect Start Logs**:
   ```bash
   docker logs --tail 50 antigravity-manager
   ```
3. **Verify Host Directory Permissions**:
   ```bash
   ls -la /home/yapilwsl/.antigravity_tools
   ```
   If files are owned by `root`, non-root utilities (and SQLite CLI) will fail with database lock/read-only errors.

---

## Troubleshooting Procedures

### 1. Resolving Host Directory Permission Errors

If `/home/yapilwsl/.antigravity_tools` or files inside are owned by `root` and passwordless `sudo` is unavailable:
1. Bypass sudo prompts by running a temporary Docker container to change ownership back to UID/GID 1000:
   ```bash
   docker run --rm -v /home/yapilwsl/.antigravity_tools:/data alpine:latest chown -R 1000:1000 /data
   ```
2. Confirm the directory and files are owned by `yapilwsl:yapilwsl`:
   ```bash
   ls -la /home/yapilwsl/.antigravity_tools
   ```

### 2. Restoring Missing Accounts (Empty Account Pool)

If logs show `沒有可用賬號` (No available accounts) or `GET /api/accounts` returns an empty array, sync them from the host's `~/.config/opencode/antigravity-accounts.json`:

1. Read the API key from `/home/yapilwsl/.antigravity_tools/gui_config.json` (`api_key` field).
2. For each active account in `~/.config/opencode/antigravity-accounts.json`, send a POST request to register it:
   ```bash
   curl -s -X POST -H "Content-Type: application/json" \
     -H "Authorization: Bearer <API_KEY>" \
     -d '{"refreshToken": "<REFRESH_TOKEN>", "name": "<EMAIL>"}' \
     http://127.0.0.1:8045/api/accounts
   ```
3. Verify registration:
   ```bash
   curl -s -H "Authorization: Bearer <API_KEY>" http://127.0.0.1:8045/api/accounts
   ```

### 3. Password / Login Lockout (Web UI & REST API)

1. Open `/home/yapilwsl/.antigravity_tools/gui_config.json`.
2. Inspect `admin_password`. If it is `null`, the UI password defaults to `api_key`.
3. To configure a simple login password (e.g., `admin`), edit `gui_config.json` and update the field:
   ```json
   "admin_password": "admin"
   ```
4. Restart the container to apply changes:
   ```bash
   docker restart antigravity-manager
   ```
5. Confirm login is authorized using `Bearer admin` or the Web UI login form.
