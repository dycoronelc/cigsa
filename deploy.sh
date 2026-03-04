#!/usr/bin/env bash
# Script de despliegue CIGSA - ejecutar desde el servidor en /var/www/cigsa
# Uso: ./deploy.sh
# La primera vez: chmod +x deploy.sh

set -e

REPO_DIR="${REPO_DIR:-/var/www/cigsa}"
BRANCH="${BRANCH:-main}"
PM2_NAME="${PM2_NAME:-cigsa-backend}"

echo "=========================================="
echo "  Despliegue CIGSA - $(date '+%Y-%m-%d %H:%M')"
echo "=========================================="

cd "${REPO_DIR}"
echo "[1/6] Directorio: $(pwd)"

echo "[2/6] Git fetch --all"
git fetch --all

echo "[3/6] Git pull origin ${BRANCH}"
git pull origin "${BRANCH}"

echo "[4/6] Backend: npm install + pm2 restart"
cd backend
npm install
pm2 restart "${PM2_NAME}"
cd ..

echo "[5/6] Frontend: npm install"
cd frontend
npm install

echo "[6/6] Frontend: npm run build"
npm run build
cd ..

echo "=========================================="
echo "  Despliegue completado."
echo "=========================================="
