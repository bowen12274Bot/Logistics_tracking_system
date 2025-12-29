-- Service Rules for Dynamic Pricing (Requirement: Maintainability)
CREATE TABLE service_rules (
    rule_key TEXT PRIMARY KEY,
    value TEXT NOT NULL, -- JSON value
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial values based on current hardcoded logic
INSERT INTO service_rules (rule_key, value, description) VALUES
('const.route_cost_k', '5200', 'Divisor for normalizing route cost'),
('const.route_cost_norm_min', '0.3', 'Minimum normalized route cost'),
('const.route_cost_norm_max', '1.6', 'Maximum normalized route cost'),
('const.international_multiplier', '1.8', 'Price multiplier for international shipments'),

('multipliers.service', '{"economy": 1.0, "standard": 1.25, "two_day": 1.55, "overnight": 2.0}', 'Price multiplier by delivery type'),
('delivery_days', '{"overnight": 1, "two_day": 2, "standard": 3, "economy": 5}', 'Expected delivery days'),

('box_params', '{"envelope": {"baseFee": 30, "ratePerCost": 90}, "S": {"baseFee": 70, "ratePerCost": 170}, "M": {"baseFee": 110, "ratePerCost": 260}, "L": {"baseFee": 160, "ratePerCost": 380}}', 'Base fee and rate per cost by box type'),
('weight_surcharge', '{"envelope": {"includedWeightKg": 0.5, "perKgFee": 0}, "S": {"includedWeightKg": 3, "perKgFee": 18}, "M": {"includedWeightKg": 10, "perKgFee": 15}, "L": {"includedWeightKg": 25, "perKgFee": 12}}', 'Weight limits and surcharge rates'),

('min_price', '{"envelope": {"economy": 50, "standard": 70, "two_day": 90, "overnight": 120}, "S": {"economy": 120, "standard": 160, "two_day": 210, "overnight": 280}, "M": {"economy": 200, "standard": 260, "two_day": 340, "overnight": 450}, "L": {"economy": 320, "standard": 420, "two_day": 550, "overnight": 750}}', 'Minimum price table'),
('max_price', '{"envelope": {"economy": 400, "standard": 550, "two_day": 700, "overnight": 950}, "S": {"economy": 900, "standard": 1200, "two_day": 1500, "overnight": 1900}, "M": {"economy": 1400, "standard": 1850, "two_day": 2350, "overnight": 2900}, "L": {"economy": 2200, "standard": 2900, "two_day": 3700, "overnight": 4600}}', 'Maximum price table'),

('mark_fees', '{"dangerous": 120, "fragile": 60}', 'Extra fees for special marks');
