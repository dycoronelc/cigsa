#!/usr/bin/env bash
set -euo pipefail

# Deploy script for CIGSA (Linux server)
# Usage:
#   ./deploy.sh
#
# Notes:
# - Assumes repo is at /var/www/cigsa
# - Assumes PM2 process name: cigsa-backend

REPO_DIR="${REPO_DIR:-/var/www/cigsa}"
BRANCH="${BRANCH:-main}"
PM2_NAME="${PM2_NAME:-cigsa-backend}"

echo "==> Deploying CIGSA in ${REPO_DIR} (branch: ${BRANCH})"

cd "${REPO_DIR}"

echo "==> Updating git branch"
git fetch --all
git pull origin "${BRANCH}"

echo "==> Backend: install deps + restart"
cd backend
npm install
pm2 restart "${PM2_NAME}"

echo "==> Frontend: install deps + build"
cd ../frontend
npm install
npm run build

echo "==> Done."

