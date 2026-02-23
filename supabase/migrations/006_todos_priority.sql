-- 優先度: high / medium / low（デフォルト medium）
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low'));
