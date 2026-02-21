-- profiles にユーザー名を追加（ユニーク制約）
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- 新規登録ユーザーが自分用のプロフィールを作成できるように INSERT ポリシーを追加
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
