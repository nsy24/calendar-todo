import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_LANGS = ["ja", "en", "zh", "ko"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

const DEEPL_LANG: Record<Lang, string> = { ja: "JA", en: "EN", zh: "ZH", ko: "KO" };
const GOOGLE_LANG: Record<Lang, string> = { ja: "ja", en: "en", zh: "zh-CN", ko: "ko" };

/**
 * DeepL API で1言語に翻訳
 * 無料枠: https://api-free.deepl.com  / 有料: https://api.deepl.com
 */
async function translateWithDeepL(
  text: string,
  targetLang: Lang,
  sourceLang: Lang,
  apiKey: string,
  baseUrl: string
): Promise<string> {
  const res = await fetch(`${baseUrl}/v2/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `DeepL-Auth-Key ${apiKey}`,
    },
    body: JSON.stringify({
      text: [text],
      target_lang: DEEPL_LANG[targetLang],
      source_lang: DEEPL_LANG[sourceLang],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    const msg = `DeepL API error: ${res.status} ${err}`;
    console.error("[translate] DeepL request failed", {
      status: res.status,
      statusText: res.statusText,
      body: err,
      targetLang,
      sourceLang,
      textLength: text.length,
    });
    throw new Error(msg);
  }
  const data = await res.json();
  const translated = data.translations?.[0]?.text;
  if (typeof translated !== "string") {
    console.error("[translate] DeepL invalid response shape", { data, targetLang, sourceLang });
    throw new Error("DeepL invalid response");
  }
  return translated;
}

/**
 * Google Cloud Translation API v2 で1言語に翻訳
 */
async function translateWithGoogle(
  text: string,
  targetLang: Lang,
  sourceLang: Lang,
  apiKey: string
): Promise<string> {
  const params = new URLSearchParams({
    q: text,
    target: GOOGLE_LANG[targetLang],
    source: GOOGLE_LANG[sourceLang],
    format: "text",
    key: apiKey,
  });
  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[translate] Google Translate request failed", {
      status: res.status,
      statusText: res.statusText,
      body: err,
      targetLang,
      sourceLang,
      textLength: text.length,
    });
    throw new Error(`Google Translate API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  const translated = data?.data?.translations?.[0]?.translatedText;
  if (typeof translated !== "string") {
    console.error("[translate] Google Translate invalid response shape", { data, targetLang, sourceLang });
    throw new Error("Google Translate invalid response");
  }
  return translated;
}

/**
 * 入力テキストを ja / en / zh / ko の4言語分に翻訳し、JSONB 用のオブジェクトで返す。
 *
 * 環境変数（APIルートはサーバーサイドのため process.env で参照）:
 * - ローカル: .env.local の DEEPL_API_KEY または GOOGLE_TRANSLATE_API_KEY
 * - Vercel: プロジェクト設定 > Environment Variables に追加（Build/Runtime で利用可能。クライアントに公開しない）
 * - DEEPL_API_KEY が設定されていれば DeepL を使用（無料枠は DEEPL_API_URL 未設定で api-free.deepl.com）
 * - それ以外で GOOGLE_TRANSLATE_API_KEY が設定されていれば Google Cloud Translation を使用
 * - どちらも未設定の場合はモック（原文を全言語でそのまま返す）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const sourceLang: Lang = SUPPORTED_LANGS.includes(body.sourceLang) ? body.sourceLang : "ja";

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const deeplKey = process.env.DEEPL_API_KEY?.trim();
    const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
    const deeplUrl = (process.env.DEEPL_API_URL || "https://api-free.deepl.com").replace(/\/$/, "");

    console.log("[translate] env check", {
      DEEPL_API_KEY: deeplKey ? "set" : "not set",
      GOOGLE_TRANSLATE_API_KEY: googleKey ? "set" : "not set",
      DEEPL_API_URL: deeplUrl,
      provider: deeplKey ? "DeepL" : googleKey ? "Google" : "mock",
    });

    const translations: Record<string, string> = {};

    for (const lang of SUPPORTED_LANGS) {
      if (lang === sourceLang) {
        translations[lang] = text;
        continue;
      }
      if (deeplKey) {
        try {
          translations[lang] = await translateWithDeepL(text, lang, sourceLang, deeplKey, deeplUrl);
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          console.error("[translate] DeepL translate error", {
            message: err.message,
            stack: err.stack,
            lang,
            sourceLang,
            textPreview: text.slice(0, 80),
          });
          translations[lang] = text;
        }
      } else if (googleKey) {
        try {
          translations[lang] = await translateWithGoogle(text, lang, sourceLang, googleKey);
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          console.error("[translate] Google Translate error", {
            message: err.message,
            stack: err.stack,
            lang,
            sourceLang,
            textPreview: text.slice(0, 80),
          });
          translations[lang] = text;
        }
      } else {
        translations[lang] = text;
      }
    }

    return NextResponse.json({ translations });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[translate] API unexpected error", {
      message: err.message,
      stack: err.stack,
      name: err instanceof Error ? err.name : undefined,
    });
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
