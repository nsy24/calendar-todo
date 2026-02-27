# 複数カレンダー（ルーム）設計案

ビジネス利用を想定し、**カレンダーごとに独立した空間**を持ち、ユーザーが複数のカレンダーに所属して切り替え表示できる仕組みの変更案です。

---

## 1. 現状の整理

| 対象 | 現状 |
|------|------|
| **todos** | `user_id`, `title`, `date`, `completed`, `created_by_username`, `priority`, `position`。カレンダー（ルーム）の概念なし。 |
| **shares** | `owner_id`, `receiver_id`, `status`。**グローバル**で「1対1の共有」のみ。 |
| **notifications** | `user_id`, `message`, ...。ユーザー単位で、ルーム単位ではない。 |

結果として「全ユーザーが1つの空間に混ざる」形になっている。

---

## 2. データベース（Supabase）変更案

### 2.1 新規テーブル

#### `calendars`（ルーム＝カレンダー）

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | uuid PK | カレンダーID |
| `name` | text NOT NULL | 表示名（例: 「第1プロジェクト」「チーム共有」） |
| `created_by` | uuid NOT NULL → auth.users(id) | 作成者（オーナー） |
| `created_at` | timestamptz | 作成日時 |

- 1レコード = 1つの「ルーム」。この中にTodoとメンバーが紐づく。

#### `calendar_members`（カレンダーごとの所属・共有）

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | uuid PK | メンバーシップID |
| `calendar_id` | uuid NOT NULL → calendars(id) ON DELETE CASCADE | どのカレンダーか |
| `user_id` | uuid NOT NULL → auth.users(id) ON DELETE CASCADE | 誰か |
| `role` | text NOT NULL | `'owner'` \| `'member'`（オーナーは1人の想定） |
| `status` | text NOT NULL DEFAULT 'pending' | `'pending'`（招待中） \| `'active'`（参加中） |
| `invited_by` | uuid → auth.users(id) | 誰の招待か（任意） |
| `created_at` | timestamptz | 作成日時 |
| UNIQUE(calendar_id, user_id) | | 1ユーザーは1カレンダーに1回だけ |

- 共有は「カレンダー単位」。同じユーザーでもカレンダーごとに別の `calendar_members` になる。
- 既存の `shares` は「ルーム」の概念がないため、**`calendar_members` に置き換える**形が自然（後述のマイグレーションで移行）。

### 2.2 既存テーブルの変更

#### `todos`

| 追加カラム | 型 | 説明 |
|------------|-----|------|
| `calendar_id` | uuid NOT NULL → calendars(id) ON DELETE CASCADE | 所属するカレンダー（ルーム） |

- 既存データ用に、マイグレーションで「デフォルトカレンダー」を用意し、既存の todo をすべてそこに紐づける（後述）。

#### `notifications`（任意）

| 追加カラム | 型 | 説明 |
|------------|-----|------|
| `calendar_id` | uuid → calendars(id) ON DELETE SET NULL | どのカレンダーでの出来事か（任意） |

- ルーム単位でお知らせを絞りたい場合のみ追加。まずは「ユーザー単位のまま」でも可。

### 2.3 RLS（Row Level Security）方針

- **calendars**:  
  - SELECT: 自分が `calendar_members` で参加（active）しているカレンダーのみ。  
  - INSERT: 認証済みユーザーが作成可能（`created_by = auth.uid()`）。  
  - UPDATE/DELETE: `created_by = auth.uid()` のときのみ（オーナーのみ）。

- **calendar_members**:  
  - SELECT: 自分がメンバーであるカレンダーのメンバー一覧、または自分がオーナー/メンバーで「招待一覧」を見るために必要。  
    - 実装例: 自分が `calendar_members` で `calendar_id` に含まれるものだけ見えるようにする。  
  - INSERT: そのカレンダーのオーナー、または「自分を追加」用のポリシー（招待承認で自分を active にする）。  
  - UPDATE: 招待の承認（receiver が status を active に）や、オーナーによる削除など。  
  - DELETE: オーナーによるメンバー削除、または自分用の「退出」。

- **todos**:  
  - SELECT: その todo の `calendar_id` に対し、自分が `calendar_members` で `status = 'active'` のものだけ。  
  - INSERT: 認証済みかつ、その `calendar_id` の active メンバー。  
  - UPDATE/DELETE: 従来どおり「自分の `user_id` の todo」のみ、に加え、同じカレンダーへのアクセス権があること。

- **notifications**:  
  - `calendar_id` を追加する場合は、「自分の通知」に加え、必要なら「そのカレンダーに関する通知」だけ見えるようにするポリシーを検討。

### 2.4 マイグレーションの流れ（概要）

1. **calendars 作成**  
   - 既存ユーザーごとに「デフォルトカレンダー」を1つ作成（例: 名前「マイカレンダー」、`created_by = そのユーザー`）。

2. **calendar_members 作成**  
   - 各デフォルトカレンダーに作成者を `role=owner`, `status=active` で1件追加。  
   - 既存の `shares` の `status='active'` について、`owner_id` のデフォルトカレンダーに `receiver_id` を `role=member`, `status=active` で追加。  
   - 必要に応じて、receiver 側のデフォルトカレンダーにも owner を member で追加（双方向で同じカレンダーを見る形にするか、運用方針に合わせてどちらか一方でも可）。

3. **todos に calendar_id 追加**  
   - `todos.calendar_id` を追加（NOT NULL にしないで一旦 nullable でも可）。  
   - 各 todo の `user_id` に対応する「そのユーザーのデフォルトカレンダー」を求め、`todos.calendar_id` を更新。  
   - 更新後、`calendar_id` を NOT NULL に変更。

4. **shares の廃止**  
   - アプリ側で `shares` を参照しなくなったことを確認したあと、`shares` テーブルを DROP またはリネームして退避。

5. **Realtime**  
   - `calendars`, `calendar_members` は必要に応じて Realtime を有効化。  
   - `todos` は既存どおり Realtime のまま（`calendar_id` でフィルタする前提）。

---

## 3. コード修正方針

### 3.1 状態・データの持ち方

- **現在のカレンダー**  
  - `currentCalendarId: string | null` のような state を1つ持ち、ヘッダーやTodo一覧・共有設定はすべて「このカレンダー」に紐づける。

- **カレンダー一覧**  
  - 自分がメンバー（active）の `calendars` を取得し、一覧表示・切り替えに使う。  
  - 初回や未選択時は「デフォルトカレンダー」や「一覧の先頭」を `currentCalendarId` にセットする。

- **メンバー・共有**  
  - 従来の `activePartners` / `pendingRequests` は **`currentCalendarId` に紐づく**ように変更。  
  - `calendar_members` から「このカレンダーの active メンバー」「pending の招待」を取得する。

- **Todo**  
  - `fetchTodos()` は `currentCalendarId` を条件にし、`todos.calendar_id = currentCalendarId` かつ（必要なら）メンバー権限で取得。  
  - 追加・更新・削除時も `calendar_id` を常に渡す。

### 3.2 API・データ取得の変更

| 処理 | 現状 | 変更後 |
|------|------|--------|
| 共有相手の取得 | `shares` を owner/receiver で検索 | `calendar_members` を `calendar_id = currentCalendarId` で検索 |
| 招待一覧（pending） | `shares` の receiver=自分 & status=pending | `calendar_members` の user_id=自分 & calendar_id=current & status=pending |
| Todo 取得 | 自分の + パートナー全員の user_id | `calendar_id = currentCalendarId` かつ、そのカレンダーのメンバーに含まれる user_id の todo |
| Todo 追加 | user_id, created_by_username 等 | 上記に加え `calendar_id = currentCalendarId` |
| 通知 | user_id のみ | そのまま user_id、必要なら calendar_id でフィルタ |

### 3.3 UI の変更

- **カレンダー切り替え**  
  - ヘッダーまたはサイドバーに「カレンダー一覧」を表示。  
  - 選択中のカレンダー名を表示し、クリックでドロップダウンまたはモーダルから別カレンダーを選択して `currentCalendarId` を更新。  
  - 切り替え時に `fetchTodos()`, `fetchShares()` 相当（メンバー取得）を再実行。

- **ルーム作成**  
  - 「新規カレンダー作成」で `calendars` に1件 insertし、作成者を `calendar_members` に owner/active で追加。  
  - 作成直後にそのカレンダーを `currentCalendarId` にセット。

- **共有（招待）**  
  - 従来の「仲間のユーザー名を入力」は **現在のカレンダーに対して**の招待に変更。  
  - ユーザー名で profiles を検索 → その user_id を `calendar_members` に pending で追加。  
  - 承認時は `calendar_members.status` を `active` に更新。  
  - 拒否時はその `calendar_members` 行を削除。

- **参加メンバー表示**  
  - 現在の `calendarMembers` は「現在のカレンダーのメンバー」から組み立てる。  
  - `calendar_members`（active）＋ profiles でアバター・名前を表示（既存の calendarMembers の考え方そのまま、取得元だけ calendar_id 付きに）。

### 3.4 ファイル・モジュールの役割

- **マイグレーション**  
  - `supabase/migrations/` に新規ファイル（例: `010_calendars_and_members.sql`, `011_todos_calendar_id.sql`, `012_migrate_shares_to_calendar_members.sql` など）を追加。

- **app/page.tsx（または分割したコンポーネント）**  
  - `currentCalendarId` の state。  
  - カレンダー一覧の取得・表示・切り替え。  
  - 上記に合わせた `fetchTodos`, `fetchShares` 相当の「現在カレンダー用」取得。  
  - 共有申請・承認・解除をすべて `calendar_members` ベースに変更。

- **型定義**  
  - `Calendar`, `CalendarMember` などの型を追加。  
  - `Todo` に `calendar_id` を追加。

---

## 4. 実装の優先順位（提案）

1. **Phase 1: DB**  
   - `calendars`, `calendar_members` 作成と RLS。  
   - `todos.calendar_id` 追加とマイグレーション。  
   - （任意）notifications の calendar_id。  
   - **実行**: `supabase/migrations/010_multi_calendar_phase1.sql` を適用（手順は下記「Phase 1 の実行手順」）。

2. **Phase 2: データ取得と状態**  
   - カレンダー一覧取得。  
   - `currentCalendarId` と、それに紐づくメンバー・Todo 取得。

3. **Phase 3: UI**  
   - カレンダー切り替えUI。  
   - ルーム作成・招待を `calendar_members` ベースに変更。  
   - 既存の「共有申請・仲間」を「このカレンダーのメンバー・招待」に置き換え。

4. **Phase 4: クリーンアップ**  
   - `shares` 参照削除、テーブル削除または退避。  
   - Realtime のチャンネルを `calendar_id` でフィルタするように調整。

---

## 5. Phase 1 の実行手順

Phase 1 用マイグレーションは `supabase/migrations/010_multi_calendar_phase1.sql` にあります。

**方法 A: Supabase CLI（推奨）**

```bash
# プロジェクトをリンク済みの場合
supabase db push
# または
supabase migration up
```

**方法 B: Supabase Dashboard**

1. [Supabase Dashboard](https://supabase.com/dashboard) → 対象プロジェクト → **SQL Editor**
2. `010_multi_calendar_phase1.sql` の内容をすべてコピーして貼り付け、**Run** で実行

**注意**

- 既存の `todos` / `shares` は削除されません。`calendars` と `calendar_members` が新規作成され、既存データが移行されます。
- `shares` テーブルは Phase 1 では削除せず残します（Phase 4 でアプリが `calendar_members` のみ参照するようになってから削除）。

---

## 6. まとめ

- **DB**: `calendars` と `calendar_members` で「ルーム単位の空間」と「ルームごとの共有」を表現し、`todos` を `calendar_id` でルームに紐づける。  
- **コード**: 「現在表示するカレンダー」を `currentCalendarId` で持ち、Todo・メンバー・招待をすべてこのIDに紐づけて取得・更新する。  
- **UI**: カレンダー一覧の表示と切り替えを追加し、共有は「現在のカレンダーへの招待」に変更する。

この方針で、複数カレンダー（ルーム）の作成・共有・切り替えができるようになります。
