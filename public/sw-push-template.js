/**
 * Web プッシュ用 Service Worker 雛形
 * バックグラウンドでプッシュ通知を受け取り、表示します。
 *
 * 使い方:
 * 1. このファイルを sw.js にマージするか、next-pwa の custom worker (worker/index.js) に
 *    以下のコードを取り込んでください。
 * 2. プッシュ送信側（サーバー）で VAPID 鍵を使い web-push 等で送信します。
 */

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = { title: "お知らせ", body: "", url: "/" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data.text() || "";
  }
  const options = {
    body: payload.body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    data: { url: payload.url || "/" },
    tag: payload.tag || "default",
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
