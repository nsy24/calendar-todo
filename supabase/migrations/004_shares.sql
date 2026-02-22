-- 共有（仕事仲間）テーブル: owner が partner_username の予定も一緒に見る
CREATE TABLE IF NOT EXISTS shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_username text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, partner_username)
);

CREATE INDEX IF NOT EXISTS idx_shares_owner_id ON shares(owner_id);

ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

-- 自分の shares のみ操作可能
DROP POLICY IF EXISTS "shares_select_own" ON shares;
CREATE POLICY "shares_select_own" ON shares FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "shares_insert_own" ON shares;
CREATE POLICY "shares_insert_own" ON shares FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "shares_delete_own" ON shares;
CREATE POLICY "shares_delete_own" ON shares FOR DELETE
  USING (auth.uid() = owner_id);

-- Realtime: Supabase Dashboard > Database > Replication で todos テーブルの Realtime を有効にしてください。
