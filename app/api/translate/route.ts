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
    throw new Error(`DeepL API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  const translated = data.translations?.[0]?.text;
  if (typeof translated !== "string") throw new Error("DeepL invalid response");
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
    throw new Error(`Google Translate API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  const translated = data?.data?.translations?.[0]?.translatedText;
  if (typeof translated !== "string") throw new Error("Google Translate invalid response");
  return translated;
}

/**
 * 入力テキストを ja / en / zh / ko の4言語分に翻訳し、JSONB 用のオブジェクトで返す。
 * APIキーは .env.local の DEEPL_API_KEY または GOOGLE_TRANSLATE_API_KEY から読み込む。
 * - DEEPL_API_KEY が設定されていれば DeepL を使用（推奨: 無料枠は DEEPL_API_URL に https://api-free.deepl.com を指定）
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

    const translations: Record<string, string> = {};
    const deeplKey = process.env.DEEPL_API_KEY?.trim();
    const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
    const deeplUrl = (process.env.DEEPL_API_URL || "https://api-free.deepl.com").replace(/\/$/, "");

    for (const lang of SUPPORTED_LANGS) {
      if (lang === sourceLang) {
        translations[lang] = text;
        continue;
      }
      if (deeplKey) {
        try {
          translations[lang] = await translateWithDeepL(text, lang, sourceLang, deeplKey, deeplUrl);
        } catch (e) {
          console.error("DeepL translate error", e);
          translations[lang] = text;
        }
      } else if (googleKey) {
        try {
          translations[lang] = await translateWithGoogle(text, lang, sourceLang, googleKey);
        } catch (e) {
          console.error("Google Translate error", e);
          translations[lang] = text;
        }
      } else {
        translations[lang] = text;
      }
    }

    return NextResponse.json({ translations });
  } catch (e) {
    console.error("Translate API error", e);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
