import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_LANGS = ["ja", "en", "zh", "ko"] as const;

/**
 * タスク名を他言語に翻訳する API（モック実装）
 *
 * 本番では以下いずれかに差し替え可能:
 * - Google Cloud Translation API (無料枠: 月 50万文字)
 *   https://cloud.google.com/translate/docs
 * - DeepL API (無料枠: 月 50万文字)
 *   https://www.deepl.com/docs-api
 *
 * モック: 入力テキストをそのまま各言語の値として返す（翻訳エンジン未接続時用）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const sourceLang = typeof body.sourceLang === "string" ? body.sourceLang : "ja";

    if (!text) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      );
    }

    // モック: 全言語に同じ文字列を返す（実装時は Google/DeepL で text を各 target に翻訳）
    const translations: Record<string, string> = {};
    for (const lang of SUPPORTED_LANGS) {
      translations[lang] = text;
    }

    return NextResponse.json({ translations });
  } catch (e) {
    console.error("Translate API error", e);
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    );
  }
}
