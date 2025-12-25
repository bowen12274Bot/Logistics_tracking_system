-- Store how the payer paid (mock payment), for payment record display.
ALTER TABLE payments ADD COLUMN payment_method TEXT;
