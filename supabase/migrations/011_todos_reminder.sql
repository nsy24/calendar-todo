-- シンプルリマインド機能: todos にリマインド用カラムを追加
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS reminder_time time,
  ADD COLUMN IF NOT EXISTS reminder_date date,
  ADD COLUMN IF NOT EXISTS is_monthly_recurring boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN todos.reminder_time IS 'リマインド時刻（時間で指定）';
COMMENT ON COLUMN todos.reminder_date IS 'リマインド日（日付で指定）';
COMMENT ON COLUMN todos.is_monthly_recurring IS '毎月この日にリマインドする場合は true。完了時に翌月同日のタスクを自動作成';
