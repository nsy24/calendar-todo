"use client";

import React, { ReactNode, useEffect, useState } from "react";
import i18n from "i18next";
import { initReactI18next, I18nextProvider } from "react-i18next";
import ja from "@/locales/ja.json";
import en from "@/locales/en.json";
import zh from "@/locales/zh.json";
import ko from "@/locales/ko.json";

const resources = {
  ja: { translation: ja },
  en: { translation: en },
  zh: { translation: zh },
  ko: { translation: ko },
};

const initOptions = {
  resources,
  lng: "ja",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
};

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init(initOptions);
}

async function ensureReady(): Promise<void> {
  if (i18n.isInitialized) return;
  await new Promise<void>((resolve) => {
    if (i18n.isInitialized) {
      resolve();
      return;
    }
    i18n.on("initialized", () => resolve());
  });
}

export default function I18nProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initI18n = async () => {
      await ensureReady();
      const savedLang = (localStorage.getItem("syncTask_lang") as "ja" | "en" | "zh" | "ko") || "ja";
      if (i18n.language !== savedLang) {
        await i18n.changeLanguage(savedLang);
      }
      setIsReady(true);
    };
    initI18n();
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-medium text-slate-400">
        Loading...
      </div>
    );
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
