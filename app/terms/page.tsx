"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
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
            {t("legal.termsTitle")}
          </h1>

          <div className="space-y-8 text-[15px] leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-slate-800 mb-3">
                {t("legal.terms.useTitle")}
              </h2>
              <p className="whitespace-pre-line">{t("legal.terms.useBody")}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mb-3">
                {t("legal.terms.translationTitle")}
              </h2>
              <p className="whitespace-pre-line">{t("legal.terms.translationBody")}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mb-3">
                {t("legal.terms.prohibitedTitle")}
              </h2>
              <p className="whitespace-pre-line">{t("legal.terms.prohibitedBody")}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mb-3">
                {t("legal.terms.disclaimerTitle")}
              </h2>
              <p className="whitespace-pre-line">{t("legal.terms.disclaimerBody")}</p>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
}
