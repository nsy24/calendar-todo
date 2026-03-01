-- アカウント削除（退会）のため、自分自身の profiles を削除できるようにする
-- クライアント側で削除順: todos (user_id=me) → calendar_members (user_id=me) → calendars (created_by=me) → profiles (id=me)

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE
  USING (auth.uid() = id);
