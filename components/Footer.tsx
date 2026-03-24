"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="mt-auto border-t border-slate-100 bg-white/50 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 py-4 md:px-8 md:py-5">
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-slate-500" aria-label="Footer">
          <Link href="/blog" className="hover:text-slate-800 transition-colors">
            {t("legal.footerBlog")}
          </Link>
          <Link href="/about" className="hover:text-slate-800 transition-colors">
            {t("legal.footerAbout")}
          </Link>
          <Link href="/contact" className="hover:text-slate-800 transition-colors">
            {t("legal.footerContact")}
          </Link>
          <Link href="/privacy" className="hover:text-slate-800 transition-colors">
            {t("legal.footerPrivacy")}
          </Link>
          <Link href="/terms" className="hover:text-slate-800 transition-colors">
            {t("legal.footerTerms")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
