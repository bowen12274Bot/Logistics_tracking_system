-- Webhook Subscriptions (Requirement: Real-time updates)
CREATE TABLE webhook_subscriptions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT, -- For signing payload
    events TEXT, -- JSON array of subscribed events, e.g. ["delivered", "exception"]
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES users(id)
);

CREATE INDEX idx_webhook_subs_customer ON webhook_subscriptions(customer_id);
