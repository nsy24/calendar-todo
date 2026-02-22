-- 申請・承認制: owner_id（申請者）, receiver_id（承認者）, status
DROP TABLE IF EXISTS shares;

CREATE TABLE shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, receiver_id)
);

CREATE INDEX idx_shares_owner_id ON shares(owner_id);
CREATE INDEX idx_shares_receiver_id ON shares(receiver_id);
CREATE INDEX idx_shares_status ON shares(status);

ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

-- 自分が申請者または承認者である行のみ操作可能
DROP POLICY IF EXISTS "shares_select_own_or_receiver" ON shares;
CREATE POLICY "shares_select_own_or_receiver" ON shares FOR SELECT
  USING (auth.uid() = owner_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "shares_insert_as_owner" ON shares;
CREATE POLICY "shares_insert_as_owner" ON shares FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "shares_update_receiver_only" ON shares;
CREATE POLICY "shares_update_receiver_only" ON shares FOR UPDATE
  USING (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "shares_delete_own_or_receiver" ON shares;
CREATE POLICY "shares_delete_own_or_receiver" ON shares FOR DELETE
  USING (auth.uid() = owner_id OR auth.uid() = receiver_id);

-- 共有申請で相手をユーザー名検索するため、ログイン済みユーザーは全プロフィールを読める
DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
CREATE POLICY "profiles_select_authenticated" ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);
