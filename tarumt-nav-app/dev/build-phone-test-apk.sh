#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
gateway_host=${1:-}

if [ -z "${gateway_host}" ] && command -v ipconfig >/dev/null 2>&1; then
  gateway_host=$(ipconfig getifaddr en0 2>/dev/null || true)
fi

if [ -z "${gateway_host}" ]; then
  echo "Usage: $0 <computer-LAN-IP>" >&2
  echo "Example: $0 192.168.1.25" >&2
  exit 1
fi

gateway_url="http://${gateway_host}:8080"
echo "Building realtime debug APK for ${gateway_url}"

cd "${project_root}/flutter_app"
flutter build apk --debug \
  --dart-define=PRESENCE_MODE=realtime \
  --dart-define=PRESENCE_BASE_URL="${gateway_url}"

echo
echo "APK: ${project_root}/flutter_app/build/app/outputs/flutter-apk/app-debug.apk"
