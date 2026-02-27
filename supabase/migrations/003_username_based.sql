-- role をやめ、username ベースに統一するための変更（第1プロジェクト・チーム共有向け）

-- profiles.role を任意に（新規ユーザーは username のみで登録可能に）
ALTER TABLE profiles
  ALTER COLUMN role DROP NOT NULL;

-- todos に「誰が作ったか」を username で持つカラムを追加
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS created_by_username text;
