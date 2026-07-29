#!/bin/sh
set -eu

password=${CLICKHOUSE_ANALYTICS_PASSWORD:?CLICKHOUSE_ANALYTICS_PASSWORD is required}

case "$password" in
  *[!A-Za-z0-9_-]*)
    printf '%s\n' "CLICKHOUSE_ANALYTICS_PASSWORD must use only ASCII letters, digits, _ or -" >&2
    exit 1
    ;;
esac

if [ "${#password}" -lt 32 ]; then
  printf '%s\n' "CLICKHOUSE_ANALYTICS_PASSWORD must contain at least 32 characters" >&2
  exit 1
fi

clickhouse-client \
  --host 127.0.0.1 \
  --user "$CLICKHOUSE_USER" \
  --password "$CLICKHOUSE_PASSWORD" \
  --multiquery <<SQL
CREATE USER IF NOT EXISTS analytics_reader
IDENTIFIED WITH sha256_password BY '$password';

ALTER USER analytics_reader
IDENTIFIED WITH sha256_password BY '$password';

GRANT SELECT ON campus_analytics.trajectory_events_v1 TO analytics_reader;
SQL

