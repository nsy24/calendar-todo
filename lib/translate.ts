/**
 * タスク名を他言語に翻訳する（/api/translate を呼ぶ）
 * モック時は同じ文字列が返る。本番では Google Translation API または DeepL を API ルート内で利用する想定。
 */
export async function translateTaskTitle(text: string): Promise<Record<string, string> | null> {
  if (!text.trim()) return null;
  try {
    const url = typeof window !== "undefined" ? "/api/translate" : `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/translate`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim(), sourceLang: "ja" }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.translations ?? null;
  } catch {
    return null;
  }
}
