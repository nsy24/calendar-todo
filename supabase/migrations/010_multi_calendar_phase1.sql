-- ============================================
-- Phase 1: 複数カレンダー（ルーム）対応
-- 設計書 docs/MULTI_CALENDAR_DESIGN.md に基づく
-- 既存データを保持しつつ calendars / calendar_members を追加し、todos に calendar_id を付与。
-- shares テーブルは Phase 4（アプリ側の切り替え後）まで残し、ここでは参照のみ移行する。
-- ============================================

-- ---------------------------------------------------------------------------
-- 1. calendars テーブル作成
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendars_created_by ON calendars(created_by);

COMMENT ON TABLE calendars IS 'カレンダー（ルーム）。1レコード＝1つの共有空間。';

-- ---------------------------------------------------------------------------
-- 2. calendar_members テーブル作成
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id uuid NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'member')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(calendar_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_members_calendar_id ON calendar_members(calendar_id);
CREATE INDEX IF NOT EXISTS idx_calendar_members_user_id ON calendar_members(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_members_status ON calendar_members(status);

COMMENT ON TABLE calendar_members IS 'カレンダーごとの所属・招待。共有はカレンダー単位。';

-- ---------------------------------------------------------------------------
-- 3. todos に calendar_id 追加（まずは nullable で追加し、移行後に NOT NULL に変更）
-- ---------------------------------------------------------------------------
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS calendar_id uuid REFERENCES calendars(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. データ移行: デフォルトカレンダー作成（todos / shares に登場する全ユーザー分）
--    既に calendars に存在する created_by は挿入しない（冪等性）
-- ---------------------------------------------------------------------------
INSERT INTO calendars (name, created_by, created_at)
SELECT 'マイカレンダー', u.id, now()
FROM (
  SELECT DISTINCT user_id AS id FROM todos WHERE user_id IS NOT NULL
  UNION
  SELECT owner_id AS id FROM shares
  UNION
  SELECT receiver_id AS id FROM shares
) u
WHERE NOT EXISTS (SELECT 1 FROM calendars c WHERE c.created_by = u.id);

-- 5. calendar_members: 各カレンダーの作成者を owner, active で追加
INSERT INTO calendar_members (calendar_id, user_id, role, status)
SELECT c.id, c.created_by, 'owner', 'active'
FROM calendars c
WHERE NOT EXISTS (
  SELECT 1 FROM calendar_members cm WHERE cm.calendar_id = c.id AND cm.user_id = c.created_by
);

-- 6. shares の active を calendar_members に移行（owner のデフォルトカレンダーに receiver を member で追加）
INSERT INTO calendar_members (calendar_id, user_id, role, status, invited_by)
SELECT c.id, s.receiver_id, 'member', 'active', s.owner_id
FROM shares s
JOIN calendars c ON c.created_by = s.owner_id
WHERE s.status = 'active'
ON CONFLICT (calendar_id, user_id) DO NOTHING;

-- 7. shares の pending を calendar_members に移行（receiver を pending で追加）
INSERT INTO calendar_members (calendar_id, user_id, role, status, invited_by)
SELECT c.id, s.receiver_id, 'member', 'pending', s.owner_id
FROM shares s
JOIN calendars c ON c.created_by = s.owner_id
WHERE s.status = 'pending'
ON CONFLICT (calendar_id, user_id) DO NOTHING;

-- 8. todos の calendar_id を、todo の user_id のデフォルトカレンダーで埋める
UPDATE todos t
SET calendar_id = (SELECT c.id FROM calendars c WHERE c.created_by = t.user_id LIMIT 1)
WHERE t.user_id IS NOT NULL AND t.calendar_id IS NULL;

-- 9. user_id が NULL の todo など、まだ calendar_id が NULL の行をいずれかのカレンダーに紐づけ（既存データ保護）
UPDATE todos
SET calendar_id = (SELECT id FROM calendars LIMIT 1)
WHERE calendar_id IS NULL
  AND EXISTS (SELECT 1 FROM calendars LIMIT 1);

-- 10. calendar_id を NOT NULL に変更（全行に値が入った場合のみ）
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM todos WHERE calendar_id IS NULL) = 0 THEN
    ALTER TABLE todos ALTER COLUMN calendar_id SET NOT NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 11. RLS: calendars
-- ---------------------------------------------------------------------------
ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendars_select_member" ON calendars;
CREATE POLICY "calendars_select_member" ON calendars FOR SELECT
  USING (
    id IN (
      SELECT calendar_id FROM calendar_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "calendars_insert_own" ON calendars;
CREATE POLICY "calendars_insert_own" ON calendars FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

DROP POLICY IF EXISTS "calendars_update_owner" ON calendars;
CREATE POLICY "calendars_update_owner" ON calendars FOR UPDATE
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "calendars_delete_owner" ON calendars;
CREATE POLICY "calendars_delete_owner" ON calendars FOR DELETE
  USING (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 12. RLS: calendar_members
-- ---------------------------------------------------------------------------
ALTER TABLE calendar_members ENABLE ROW LEVEL SECURITY;

-- 自分がメンバー（または招待受け）であるカレンダーのメンバー一覧を見える
DROP POLICY IF EXISTS "calendar_members_select_same_calendar" ON calendar_members;
CREATE POLICY "calendar_members_select_same_calendar" ON calendar_members FOR SELECT
  USING (
    calendar_id IN (
      SELECT calendar_id FROM calendar_members WHERE user_id = auth.uid()
    )
  );

-- カレンダーのオーナーのみがメンバーを追加（招待）できる
DROP POLICY IF EXISTS "calendar_members_insert_by_owner" ON calendar_members;
CREATE POLICY "calendar_members_insert_by_owner" ON calendar_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calendars c
      WHERE c.id = calendar_id AND c.created_by = auth.uid()
    )
  );

-- 招待承認: 自分宛ての pending を active にできる。オーナーはメンバーの status を変更可能
DROP POLICY IF EXISTS "calendar_members_update_accept_or_owner" ON calendar_members;
CREATE POLICY "calendar_members_update_accept_or_owner" ON calendar_members FOR UPDATE
  USING (
    (user_id = auth.uid() AND status = 'pending')  -- 自分が承認
    OR
    EXISTS (SELECT 1 FROM calendars c WHERE c.id = calendar_id AND c.created_by = auth.uid())
  );

-- オーナーはメンバーを削除できる。メンバーは自分を削除（退出）できる
DROP POLICY IF EXISTS "calendar_members_delete_owner_or_self" ON calendar_members;
CREATE POLICY "calendar_members_delete_owner_or_self" ON calendar_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    EXISTS (SELECT 1 FROM calendars c WHERE c.id = calendar_id AND c.created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 13. RLS: todos を calendar ベースに変更
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "todos_select_all" ON todos;
CREATE POLICY "todos_select_calendar_member" ON todos FOR SELECT
  USING (
    calendar_id IS NOT NULL
    AND calendar_id IN (
      SELECT calendar_id FROM calendar_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- INSERT は従来「user_id = auth.uid()」に加え、その calendar の active メンバーであること
DROP POLICY IF EXISTS "todos_insert_authenticated" ON todos;
CREATE POLICY "todos_insert_calendar_member" ON todos FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND calendar_id IN (
      SELECT calendar_id FROM calendar_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- UPDATE / DELETE は従来どおり「自分の todo のみ」
DROP POLICY IF EXISTS "todos_update_own" ON todos;
CREATE POLICY "todos_update_own" ON todos FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "todos_delete_own" ON todos;
CREATE POLICY "todos_delete_own" ON todos FOR DELETE
  USING (auth.uid() = user_id);
