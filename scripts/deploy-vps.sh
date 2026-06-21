#!/usr/bin/env bash
# scripts/deploy-vps.sh
# Syncs Antigravity Manager configurations and deploys the container to the VPS.

set -e

VPS_USER="vps466a"
VPS_IP="10.32.34.243"
VPS_HOST="${VPS_USER}@${VPS_IP}"

echo "=== 1. Syncing Configurations to VPS ==="
# Use rsync to mirror the local .antigravity_tools to the VPS
# This ensures the VPS has all the accounts, tokens, and Web UI passwords
rsync -avz --delete ~/.antigravity_tools/ "${VPS_HOST}:~/.antigravity_tools/"

echo ""
echo "=== 2. Checking Docker Image on VPS ==="
# Check if the patched image exists on the VPS, if not, copy and load it
ssh "${VPS_HOST}" "docker images -q antigravity-manager:patched" > /dev/null 2>&1
IMAGE_EXISTS=$?

if [ $IMAGE_EXISTS -ne 0 ]; then
    echo "Image not found on VPS. Transferring patched image (this may take a minute)..."
    scp ~/arthityap/crush/antigravity-manager-patched.tar.gz "${VPS_HOST}:~/"
    echo "Loading Docker image on VPS..."
    ssh "${VPS_HOST}" "docker load < ~/antigravity-manager-patched.tar.gz"
else
    echo "Patched image already loaded on VPS."
fi

echo ""
echo "=== 3. Deploying Antigravity Manager Container ==="
# Restart the container with the correct ZeroTier bindings
ssh "${VPS_HOST}" "bash -s" << 'EOF'
    echo "Stopping existing container..."
    docker stop antigravity-manager 2>/dev/null || true
    docker rm antigravity-manager 2>/dev/null || true

    echo "Starting new container bound to ZeroTier..."
    docker run -d \
        --name antigravity-manager \
        --restart unless-stopped \
        -p 10.32.34.243:8045:8045 \
        -e ABV_MAX_BODY_SIZE=104857600 \
        -v ~/.antigravity_tools:/root/.antigravity_tools \
        antigravity-manager:patched

    echo ""
    echo "=== Container Status ==="
    docker ps --filter "name=antigravity-manager" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
EOF

echo ""
echo "✅ Deployment Complete!"
echo "Web UI and API are now accessible at http://${VPS_IP}:8045"
