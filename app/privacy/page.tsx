"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("legal.backToTop")}
        </Link>

        <article className="rounded-2xl border border-slate-100 bg-white/80 backdrop-blur-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] p-6 md:p-10 text-slate-700">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mb-8">
            {t("legal.privacyTitle")}
          </h1>

          <div className="space-y-8 text-[15px] leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-slate-800 mb-3">
                {t("legal.privacy.adsenseTitle")}
              </h2>
              <p className="whitespace-pre-line">{t("legal.privacy.adsenseBody")}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mb-3">
                {t("legal.privacy.cookiesTitle")}
              </h2>
              <p className="whitespace-pre-line">{t("legal.privacy.cookiesBody")}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mb-3">
                {t("legal.privacy.analyticsTitle")}
              </h2>
              <p className="whitespace-pre-line">{t("legal.privacy.analyticsBody")}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mb-3">
                {t("legal.privacy.personalTitle")}
              </h2>
              <p className="whitespace-pre-line">{t("legal.privacy.personalBody")}</p>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
}
