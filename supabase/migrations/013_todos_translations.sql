-- タスク名の多言語翻訳を保持するカラム（JSONB）
-- 形式: { "ja": "日本語タイトル", "en": "English title", "zh": "简体", "ko": "한국어" }
-- 原文は title カラムのまま。翻訳がない言語はクライアントで title をフォールバック表示する。
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS translations jsonb DEFAULT NULL;

COMMENT ON COLUMN todos.translations IS 'タスク名の言語別翻訳。キー: ja, en, zh, ko。未設定時は title を表示';
