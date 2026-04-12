#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="md-local:word-import"
CONTAINER_NAME="md-local"
HOST_PORT="18080"

cd "$(dirname "$0")/.."

echo "[1/3] Build image: ${IMAGE_NAME}"
docker build -f Dockerfile.orbstack -t "${IMAGE_NAME}" .

echo "[2/3] Replace old container if exists"
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

echo "[3/3] Run container: ${CONTAINER_NAME}"
docker run -d \
  --name "${CONTAINER_NAME}" \
  -p "${HOST_PORT}:80" \
  "${IMAGE_NAME}" >/dev/null

echo "✅ Ready: http://localhost:${HOST_PORT}"
