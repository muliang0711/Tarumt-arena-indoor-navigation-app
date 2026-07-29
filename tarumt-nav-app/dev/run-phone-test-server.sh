#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required to generate temporary development secrets." >&2
  exit 1
fi

: "${PRESENCE_ADDRESS:=:8080}"
: "${PRESENCE_BACKEND:=memory}"
: "${PRESENCE_JWT_SECRET:=$(openssl rand -hex 32)}"
: "${PRESENCE_IDENTITY_HMAC_SECRET:=$(openssl rand -hex 32)}"

export PRESENCE_ADDRESS
export PRESENCE_BACKEND
export PRESENCE_JWT_SECRET
export PRESENCE_IDENTITY_HMAC_SECRET

echo "Starting phone-test Gateway on ${PRESENCE_ADDRESS} (${PRESENCE_BACKEND})."
echo "Keep this terminal open while testing the APK."

cd "${project_root}/services/presence-gateway"
exec go run ./cmd/presence-gateway
