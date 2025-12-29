-- Rate Limiting table (Requirement: Stability)
CREATE TABLE rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER DEFAULT 1,
    last_request_at INTEGER
);
