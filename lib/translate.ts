/**
 * タスク名を他言語に翻訳する（/api/translate を呼ぶ）。
 * APIキーは .env.local の DEEPL_API_KEY または GOOGLE_TRANSLATE_API_KEY で指定。未設定時は原文をそのまま返す。
 * エラー時（4xx/5xx またはネットワークエラー）は例外を投げる。呼び出し元で catch してトースト表示等すること。
 */
export async function translateTaskTitle(text: string): Promise<Record<string, string> | null> {
  if (!text.trim()) return null;
  const url = typeof window !== "undefined" ? "/api/translate" : `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/translate`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.trim(), sourceLang: "ja" }),
  });
  if (!res.ok) {
    const body = await res.text();
    let errMsg: string;
    try {
      const j = JSON.parse(body);
      errMsg = (j?.error ?? body) || `HTTP ${res.status}`;
    } catch {
      errMsg = body || `HTTP ${res.status}`;
    }
    console.error("[translate] API error", { status: res.status, statusText: res.statusText, body: errMsg });
    throw new Error(`翻訳APIエラー: ${res.status} ${errMsg}`);
  }
  const data = await res.json();
  const translations = data.translations ?? null;
  if (translations && typeof translations !== "object") {
    console.error("[translate] invalid response", { data });
    throw new Error("翻訳APIの応答形式が不正です");
  }
  return translations;
}
