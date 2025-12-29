-- Access Logs table for security auditing (Requirement 2.4, 114)
CREATE TABLE access_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT, -- Nullable for unauthenticated requests
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status INTEGER NOT NULL,
    duration_ms INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_access_logs_created_at ON access_logs(created_at);
CREATE INDEX idx_access_logs_user_id ON access_logs(user_id);
