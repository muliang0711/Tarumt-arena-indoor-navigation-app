#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
presence_base_url=${1:-}

if [ -z "${presence_base_url}" ]; then
  echo "Usage: $0 <presence-base-url>" >&2
  echo "Example: $0 https://presence.example.com" >&2
  exit 1
fi

case "${presence_base_url}" in
  http://*|https://*) ;;
  *)
    echo "Presence base URL must start with http:// or https://" >&2
    exit 1
    ;;
esac

echo "Building Hybrid APK with one local and one remote actor."
echo "Presence Gateway: ${presence_base_url}"

cd "${project_root}/flutter_app"
flutter build apk --debug \
  --dart-define=PRESENCE_MODE=hybrid \
  --dart-define=PRESENCE_BASE_URL="${presence_base_url}" \
  --dart-define=PRESENCE_REMOTE_VISIBLE_LIMIT=1

echo
echo "APK: ${project_root}/flutter_app/build/app/outputs/flutter-apk/app-debug.apk"
