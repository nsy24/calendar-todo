# PWA と Web プッシュ通知の設定

## 1. PWA の基本設定

- **manifest**: `public/manifest.json` でアプリ名・アイコン・テーマカラーを定義しています。
- **next-pwa**: `@ducanh2912/next-pwa` によりビルド時に Service Worker が生成され、オフラインキャッシュが有効になります。
- **アイコン**: `public/icons/icon-192x192.png` と `public/icons/icon-512x512.png` を配置してください。未配置の場合は PWA インストール時にデフォルトアイコンが使われます。

## 2. Service Worker（プッシュ通知）

- **メイン SW**: next-pwa が `public/sw.js` をビルド時に生成します（`npm run build` で PWA 有効時）。
- **プッシュ用雛形**: `public/sw-push-template.js` にプッシュ受信・通知クリックのサンプルコードがあります。  
  サーバーから Web プッシュを送る実装時に、next-pwa のカスタムワーカー（`worker/index.js`）に取り込むか、ご自身の SW にマージして利用してください。
- ビルドが完了しない場合（terser で止まる場合）は、一時的に `DISABLE_PWA=1 npm run build` で PWA を無効にしてビルドできます。本番では PWA を有効にしたうえで、環境によってはメモリを増やす（例: `NODE_OPTIONS=--max-old-space-size=4096`）と解消することがあります。

## 3. 通知許可

- ログイン後の初回読み込み時に、ブラウザの「通知の許可」プロンプトが表示されます（`Notification.permission === "default"` の場合）。
- ヘッダーの **「通知を有効にする」** ボタンからも、任意のタイミングで許可をリクエストできます。

---

# VAPID 鍵の生成方法（Web プッシュ用）

Web プッシュでは、サーバーがクライアントを識別するために **VAPID（Voluntary Application Server Identification）** の公開鍵・秘密鍵を使います。  
Apple Developer Program は不要で、ブラウザ標準の仕組みだけで利用できます。

## 方法 A: Node.js で生成（推奨）

1. **web-push をインストール**（鍵生成のみならグローバルでも可）:

   ```bash
   npm install web-push -g
   ```

2. **鍵を生成**:

   ```bash
   npx web-push generate-vapid-keys
   ```

   または Node スクリプトで:

   ```bash
   node -e "const webpush = require('web-push'); const keys = webpush.generateVAPIDKeys(); console.log('Public Key:', keys.publicKey); console.log('Private Key:', keys.privateKey);"
   ```

3. 表示される **Public Key** をフロントで `pushManager.subscribe()` に渡し、**Private Key** はサーバーにのみ保存し、プッシュ送信時に使用します。

## 方法 B: OpenSSL で生成

1. 秘密鍵を生成:

   ```bash
   openssl ecparam -name prime256v1 -genkey -noout -out vapid_private.pem
   ```

2. 公開鍵を導出:

   ```bash
   openssl ec -in vapid_private.pem -pubout -out vapid_public.pem
   ```

3. Web プッシュで使う形式（URL Safe Base64）に変換する処理をサーバー側で実装する必要があります。多くの場合は **方法 A（web-push）** の利用が簡単です。

## 環境変数での管理例

- `.env.local`（またはサーバー用の環境変数）に保存:

  ```
  VAPID_PUBLIC_KEY=BF...（公開鍵）
  VAPID_PRIVATE_KEY=...（秘密鍵）
  ```

- **公開鍵**はクライアントに渡して `pushManager.subscribe({ applicationServerKey: vapidPublicKey })` に使用。
- **秘密鍵**はサーバーにのみ保持し、`web-push.sendNotification(subscription, payload, { vapidDetails: { privateKey, publicKey } })` のように送信時に使用。

## 注意事項

- 秘密鍵は **絶対に** クライアントやリポジトリにコミットしないでください。
- 本番と開発で別々の VAPID 鍵ペアを使うことを推奨します。
- プッシュ送信はバックエンド（API ルートや別サーバー）で行い、Supabase の Edge Functions や Next.js API Routes から `web-push` で送る構成が一般的です。
