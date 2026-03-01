# RLS・権限・削除の静的解析結果

## 1. リマインドの自動生成（完了時に翌月分を作る）

### 確認内容
- 翌月分タスク作成時に `user_id` が DB のデフォルトに頼らず**コードで明示されているか**

### 結果: ✅ 問題なし

**該当コード** (`app/page.tsx` 1070–1090 行付近):

```ts
const nextUserId = target.userId ?? session.user.id;
await supabase.from("todos").insert([
  {
    title: target.text,
    date: nextDateStr,
    calendar_id: currentCalendarId,
    user_id: nextUserId,   // 明示的にセット
    created_by_username: profile?.username?.trim() ?? "",
    priority: target.priority,
    position: 0,
    is_monthly_recurring: true,
    reminder_time: reminderTimeVal,
    reminder_date: target.reminderDate ?? nextDateStr,
  },
]);
```

- `user_id` は **必ずコードで `nextUserId` として渡している**（DB デフォルトに依存していない）。
- `nextUserId = target.userId ?? session.user.id` により、元タスクの `user_id` を引き継ぎ、無い場合のみ現在ユーザーを使う。

---

## 2. カレンダー名の変更（calendars UPDATE）

### 確認内容
- `calendars` の UPDATE が `created_by = auth.uid()` で正しく縛られているか

### 結果: ✅ 問題なし

**RLS** (`supabase/migrations/010_multi_calendar_phase1.sql` 124–126 行):

```sql
DROP POLICY IF EXISTS "calendars_update_owner" ON calendars;
CREATE POLICY "calendars_update_owner" ON calendars FOR UPDATE
  USING (created_by = auth.uid());
```

- UPDATE は **作成者（`created_by = auth.uid()`）の行だけ** 許可されている。

**アプリ側** (`app/page.tsx` 1330 行付近):

```ts
const { error } = await supabase
  .from("calendars")
  .update({ name })
  .eq("id", currentCalendarId)
  .eq("created_by", session.user.id);
```

- WHERE に `created_by = session.user.id` を付けているため、RLS と整合しており、**他人のカレンダーは更新できない**。

---

## 3. アカウント削除（profiles 削除と todos の関係）

### 確認内容
- profiles を消したとき、紐づく todos がカスケード削除で消えるか

### 結果: ⚠️ カスケードは「profiles → todos」には無いが、アプリの削除順で問題なし

**スキーマの事実:**

- `todos.user_id` は **`auth.users(id)` を参照**（`001_auth_and_todos.sql`）  
  `ON DELETE SET NULL` のため、**profiles には紐づいていない**。
- `profiles.id` は `auth.users(id)` を参照（`ON DELETE CASCADE`）。  
  つまり「auth.users を消す → profiles がカスケードで消える」であり、**「profiles を消す → todos が消える」というカスケードは存在しない**。

**アプリの削除順** (`app/page.tsx` handleDeleteAccount):

1. `todos.delete().eq("user_id", uid)` … 自分の todo を先に削除  
2. `calendar_members.delete().eq("user_id", uid)`  
3. 自分が作成した `calendars` を削除（必要なら CASCADE でそのカレンダー配下の todos 等も削除）  
4. `profiles.delete().eq("id", uid)` … 最後に profiles を削除  

この順で**先に todos を明示削除してから profiles を消している**ため、「profiles を消したとき、紐づく todos が残る」ことはない。  
つまり「紐づく todos がちゃんと消える」は **DB の profiles 削除のカスケードではなく、アプリの削除順で保証されている**。

### 結論
- **profiles 削除のカスケードで todos は消えない**（todos は auth.users 参照のため）。
- **アカウント削除時は、todos → calendar_members → calendars → profiles の順で明示削除しているため、todos は確実に消えており、権限不足や孤立データの心配は不要。**

---

## まとめ

| 項目 | 結果 | 備考 |
|------|------|------|
| リマインド翌月分の user_id | ✅ コードで明示 | `user_id: nextUserId` を必ず渡している |
| カレンダー名変更の UPDATE 権限 | ✅ RLS で縛られている | `created_by = auth.uid()` とクライアントの WHERE で二重にガード |
| アカウント削除時の todos | ✅ 消える | profiles のカスケードではなく、**削除順で先に todos を削除**しているため問題なし |
