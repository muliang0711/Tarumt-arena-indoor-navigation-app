CREATE USER IF NOT EXISTS analytics_reader IDENTIFIED WITH plaintext_password BY 'local-reader-only';
GRANT SELECT ON campus_analytics.trajectory_events_v1 TO analytics_reader;
GRANT SELECT ON campus_analytics.journey_lifecycle_events_v1 TO analytics_reader;
