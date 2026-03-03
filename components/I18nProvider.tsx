"use client";

import React, { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
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

function initI18n() {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources,
      lng: typeof window !== "undefined" ? (localStorage.getItem("syncTask_lang") as "ja" | "en" | "zh" | "ko") || "ja" : "ja",
      fallbackLng: "ja",
      defaultNS: "app",
      interpolation: { escapeValue: false },
      supportedLngs: ["ja", "en", "zh", "ko"],
    });
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initI18n();
  }, []);
  if (!i18n.isInitialized) {
    initI18n();
  }
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
