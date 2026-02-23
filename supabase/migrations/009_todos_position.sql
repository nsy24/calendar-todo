-- 同一日付・同一優先度内の並び順用
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
