-- Store how the customer paid the bill (credit_card/bank_transfer) for payment record display.
ALTER TABLE monthly_billing ADD COLUMN paid_method TEXT;
