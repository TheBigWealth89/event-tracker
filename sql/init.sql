-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create the table
CREATE TABLE event_counts (
    bucket TIMESTAMPTZ NOT NULL,
    event_name TEXT NOT NULL,
    count INT NOT NULL,
    PRIMARY KEY (bucket, event_name)
);

-- Convert it to a hypertable
SELECT create_hypertable('event_counts', 'bucket');