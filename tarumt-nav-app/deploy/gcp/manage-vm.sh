#!/usr/bin/env bash
set -euo pipefail

project_id=${GCP_PROJECT_ID:-formidable-gate-504309-r6}
zone=${GCP_ZONE:-asia-southeast1-b}
instance=${GCP_INSTANCE:-tarumt-backend}

usage() {
  cat <<EOF
Usage: $0 <start|stop|status|ssh>

Environment overrides:
  GCP_PROJECT_ID  Google Cloud project (default: $project_id)
  GCP_ZONE        Compute Engine zone (default: $zone)
  GCP_INSTANCE    VM instance name (default: $instance)
EOF
}

if ! command -v gcloud >/dev/null 2>&1; then
  printf '%s\n' "gcloud is required. Run this script in Google Cloud Shell or install the Google Cloud CLI." >&2
  exit 1
fi

action=${1:-}

instance_status() {
  gcloud compute instances describe "$instance" \
    --project="$project_id" \
    --zone="$zone" \
    --format='value(status)'
}

show_status() {
  gcloud compute instances describe "$instance" \
    --project="$project_id" \
    --zone="$zone" \
    --format='table(name,status,zone.basename(),machineType.basename(),networkInterfaces[0].accessConfigs[0].natIP:label=EXTERNAL_IP)'
}

case "$action" in
  start)
    if [[ $(instance_status) == "RUNNING" ]]; then
      printf '%s\n' "$instance is already running."
    else
      gcloud compute instances start "$instance" \
        --project="$project_id" \
        --zone="$zone"
    fi
    show_status
    printf '%s\n' "The VM is running. Allow about one minute for Docker and the public gateway to become ready."
    ;;
  stop)
    if [[ $(instance_status) == "TERMINATED" ]]; then
      printf '%s\n' "$instance is already stopped."
      exit 0
    fi
    read -r -p "Stop $instance? The backend will become unavailable. [y/N] " answer
    if [[ ! "$answer" =~ ^[Yy]$ ]]; then
      printf '%s\n' "Cancelled."
      exit 0
    fi
    gcloud compute instances stop "$instance" \
      --project="$project_id" \
      --zone="$zone"
    show_status
    ;;
  status)
    show_status
    ;;
  ssh)
    exec gcloud compute ssh "$instance" \
      --project="$project_id" \
      --zone="$zone"
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
