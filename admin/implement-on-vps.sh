#!/usr/bin/env bash
set -euo pipefail

# VPS configuration
VPS_USER="vps466a"
VPS_HOST="10.32.34.243"
VPS_TARGET="vps466a"
LOCAL_HOME="/home/yapilwsl"
VPS_HOME="/home/vps466a"
LOCAL_PROJECT_DIR="${LOCAL_HOME}/arthityap/ocagvrotate"
VPS_PROJECT_DIR="${VPS_HOME}/arthityap/ocagvrotate"

echo "=== 1. Creating target directories on VPS ==="
ssh ${VPS_TARGET} "mkdir -p ${VPS_PROJECT_DIR} ~/.config/opencode/plugins ~/.config/opencode/skills"

echo "=== 2. Syncing project codebase to VPS ==="
# Exclude node_modules, .beads, .git, etc.
rsync -avz --delete \
  --exclude="node_modules" \
  --exclude=".beads" \
  --exclude=".git" \
  --exclude=".claude" \
  --exclude="dist" \
  "${LOCAL_PROJECT_DIR}/" "${VPS_TARGET}:${VPS_PROJECT_DIR}/"

echo "=== 3. Syncing local OpenCode configuration ==="
# Sync package.json and skills
rsync -avz --delete "${LOCAL_HOME}/.config/opencode/skills/" "${VPS_TARGET}:${VPS_HOME}/.config/opencode/skills/"
scp "${LOCAL_HOME}/.config/opencode/package.json" "${VPS_TARGET}:${VPS_HOME}/.config/opencode/package.json"

echo "=== 4. Syncing Antigravity accounts (OAuth tokens) ==="
scp "${LOCAL_HOME}/.config/opencode/antigravity-accounts.json" "${VPS_TARGET}:${VPS_HOME}/.config/opencode/antigravity-accounts.json"

echo "=== 5. Mirroring and adjusting opencode.json & opencode.jsonc ==="
# We read the local opencode.json, replace /home/yapilwsl with /home/vps466a, and write to both opencode.json and opencode.jsonc on the VPS.
LOCAL_CONFIG_JSON=$(cat "${LOCAL_HOME}/.config/opencode/opencode.json")
VPS_CONFIG_JSON=$(echo "${LOCAL_CONFIG_JSON}" | sed "s|/home/yapilwsl|/home/vps466a|g")

ssh ${VPS_TARGET} "cat << 'EOF' > ~/.config/opencode/opencode.json
${VPS_CONFIG_JSON}
EOF
cp ~/.config/opencode/opencode.json ~/.config/opencode/opencode.jsonc"

echo "=== 6. Installing npm packages on VPS ==="
ssh ${VPS_TARGET} "export PATH=\"${VPS_HOME}/.nvm/versions/node/v22.22.3/bin:\$PATH\" && cd ~/.config/opencode && npm install"

echo "=== 7. Building project plugin on VPS ==="
ssh ${VPS_TARGET} "export PATH=\"${VPS_HOME}/.nvm/versions/node/v22.22.3/bin:\$PATH\" && cd ${VPS_PROJECT_DIR} && npm install && npm run build"

echo "=== 8. Verification ==="
ssh ${VPS_TARGET} "export PATH=\"${VPS_HOME}/.nvm/versions/node/v22.22.3/bin:\$PATH\" && ~/.opencode/bin/opencode --version || echo 'Failed to run opencode'"
echo "Deployment and mirroring completed successfully!"
