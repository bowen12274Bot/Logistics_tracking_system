-- Delivery Signature columns (Requirement: Proof of Delivery)
ALTER TABLE packages ADD COLUMN signature_image TEXT; -- Base64 encoded image or URL
ALTER TABLE packages ADD COLUMN signed_by TEXT; -- Name of person signing
