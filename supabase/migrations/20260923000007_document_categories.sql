ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS category text;

CREATE INDEX IF NOT EXISTS documents_category_idx ON documents (category)
  WHERE category IS NOT NULL;

COMMENT ON COLUMN documents.category IS
  'Document section bucket: roof | walls | premium | general | null (uncategorised)';
