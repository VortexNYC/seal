ALTER TABLE documents ADD COLUMN qr_token TEXT;
ALTER TABLE documents ADD COLUMN document_hash TEXT;
ALTER TABLE documents ADD COLUMN completed_at INTEGER;
CREATE UNIQUE INDEX documents_qr_token_idx ON documents(qr_token);
