-- ============================================
-- Supabase Auth と プロフィール・チーム用のテーブル変更
-- ============================================
-- 1. プロフィールテーブル（ユーザー識別・チーム用）
-- 2. todos に user_id と created_by_role を追加
-- 3. RLS で「カレンダーは共有」「自分のは編集可」に

-- 既存の todos がある場合、user_id を後から入れられるように一旦 nullable で追加
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_role text CHECK (created_by_role IN ('me', 'sibling'));

-- 既存行は created_by_role を 'me' にしておく（後で Supabase ダッシュボードで手動設定しても可）
-- UPDATE todos SET created_by_role = 'me' WHERE created_by_role IS NULL;

-- プロフィール: Auth のユーザーと表示名の対応
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('me', 'sibling')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 新規ユーザー作成時にプロフィールを作る（Supabase Auth のトリガーで実行する想定）
-- ここでは手動で2人分を入れる前提。Supabase Dashboard > Authentication > Users でユーザー作成後、
-- SQL Editor で以下を実行:
--   INSERT INTO profiles (id, role) VALUES ('あなたのuser_idのuuid', 'me');
--   INSERT INTO profiles (id, role) VALUES ('メンバーのuser_idのuuid', 'sibling');

-- RLS 有効化
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- todos: 全員が読み取り可能（共有カレンダー）、追加はログイン済みのみ、更新・削除は自分の行のみ
DROP POLICY IF EXISTS "todos_select_all" ON todos;
CREATE POLICY "todos_select_all" ON todos FOR SELECT USING (true);

DROP POLICY IF EXISTS "todos_insert_authenticated" ON todos;
CREATE POLICY "todos_insert_authenticated" ON todos FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "todos_update_own" ON todos;
CREATE POLICY "todos_update_own" ON todos FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "todos_delete_own" ON todos;
CREATE POLICY "todos_delete_own" ON todos FOR DELETE
  USING (auth.uid() = user_id);

-- profiles: 自分自身のプロフィールのみ読み取り可能
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  USING (auth.uid() = id);

-- 管理用: プロフィールの更新はサービスロールで行う想定（または自分自身のみ更新可にする）
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (auth.uid() = id);
