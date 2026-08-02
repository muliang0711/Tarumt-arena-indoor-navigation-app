CREATE USER IF NOT EXISTS analytics_reader
IDENTIFIED WITH plaintext_password BY 'analytics-test';

GRANT SELECT ON campus_analytics.trajectory_events_v1 TO analytics_reader;
