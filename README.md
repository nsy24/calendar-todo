# カレンダーTodoリスト

弟と共有できるカレンダー形式のTodoリストアプリケーションです。

## 機能

- 📅 カレンダー表示（日付を選択してTodoを追加）
- ✅ Todoの追加、削除、完了チェック機能
- 🎨 Shadcn UIを使用したモダンなデザイン
- 💾 モックデータでの動作（後でSupabaseに接続予定）

## 必要なライブラリのインストール

以下のコマンドを実行して、必要なパッケージをインストールしてください：

```bash
cd calendar-todo
npm install
```

または

```bash
cd calendar-todo
yarn install
```

## 開発サーバーの起動

```bash
npm run dev
```

または

```bash
yarn dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアプリケーションを確認できます。

## 技術スタック

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Shadcn UI**
- **date-fns** (日付操作)
- **lucide-react** (アイコン)

## プロジェクト構造

```
calendar-todo/
├── app/
│   ├── layout.tsx      # ルートレイアウト
│   ├── page.tsx        # メインページ
│   └── globals.css     # グローバルスタイル
├── components/
│   └── ui/             # Shadcn UIコンポーネント
│       ├── button.tsx
│       ├── calendar.tsx
│       ├── card.tsx
│       ├── checkbox.tsx
│       └── input.tsx
├── lib/
│   └── utils.ts        # ユーティリティ関数
└── package.json
```

## 今後の拡張予定

- Supabaseとの統合（データベース接続）
- リアルタイム同期機能
- ユーザー認証
- 複数ユーザー間での共有機能
