"use client";

import React, { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ja from "@/locales/ja.json";
import en from "@/locales/en.json";
import zh from "@/locales/zh.json";
import ko from "@/locales/ko.json";

const resources = {
  ja: { translation: ja as Record<string, unknown> },
  en: { translation: en as Record<string, unknown> },
  zh: { translation: zh as Record<string, unknown> },
  ko: { translation: ko as Record<string, unknown> },
};

const initOptions = {
  resources,
  lng: "ja",
  fallbackLng: "ja",
  defaultNS: "translation",
  ns: ["translation"],
  interpolation: { escapeValue: false },
  supportedLngs: ["ja", "en", "zh", "ko"],
  react: { useSuspense: false },
};

i18n.use(initReactI18next);

/** i18n を一度だけ初期化。init は Promise を返すため、ready になるまで子を出さない */
function ensureI18nInit(): Promise<void> {
  if (i18n.isInitialized) return Promise.resolve();
  return i18n.init(initOptions);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const lng = typeof window !== "undefined" ? (localStorage.getItem("syncTask_lang") as "ja" | "en" | "zh" | "ko") || "ja" : "ja";
    ensureI18nInit()
      .then(() => (i18n.language !== lng ? i18n.changeLanguage(lng) : Promise.resolve()))
      .then(() => setIsReady(true))
      .catch((err) => {
        console.error("i18n init failed", err);
        setIsReady(true);
      });
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading...</p>
      </div>
    );
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
