"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Mail } from "lucide-react";

export default function AboutPage() {
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
            {t("about.title")}
          </h1>

          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {t("about.operator")}
              </h2>
              <p className="text-xl font-semibold text-slate-800">{t("about.operatorName")}</p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {t("about.skills")}
              </h2>
              <p className="text-[15px] leading-relaxed text-slate-700">
                {t("about.skillsList")}
              </p>
            </section>

            <section className="pt-2">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-slate-800 bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-[0_4px_14px_rgba(0,0,0,0.06)] hover:bg-white/90 hover:border-slate-200 transition-all duration-200"
              >
                <Mail className="h-4 w-4" />
                {t("about.contactLabel")}
              </Link>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
}
