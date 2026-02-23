-- お知らせ（通知履歴）テーブル
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_read boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 自分の通知のみ読み取り可能
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- 認証済みユーザーは自分宛て・仲間宛ての通知を挿入可能（タスク操作時に使用）
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON notifications;
CREATE POLICY "notifications_insert_authenticated" ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 自分の通知のみ更新可能（既読にする）
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  USING (auth.uid() = user_id);
