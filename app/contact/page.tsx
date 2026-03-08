"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ContactPage() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      // 実際の送信先（API・メール送信等）に差し替え可能
      await new Promise((r) => setTimeout(r, 800));
      setStatus("sent");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("legal.backToTop")}
        </Link>

        <div className="rounded-2xl border border-slate-100 bg-white/80 backdrop-blur-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] p-6 md:p-10">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mb-8">
            {t("contact.title")}
          </h1>

          {status === "sent" && (
            <p className="mb-6 p-4 rounded-xl bg-emerald-50 text-emerald-800 text-sm">
              {t("contact.sent")}
            </p>
          )}
          {status === "error" && (
            <p className="mb-6 p-4 rounded-xl bg-red-50 text-red-800 text-sm">
              {t("contact.error")}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="contact-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                {t("contact.nameLabel")}
              </label>
              <Input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("contact.namePlaceholder")}
                required
                className="rounded-xl border-slate-200 bg-white/90 backdrop-blur-sm"
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                {t("contact.emailLabel")}
              </label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("contact.emailPlaceholder")}
                required
                className="rounded-xl border-slate-200 bg-white/90 backdrop-blur-sm"
              />
            </div>
            <div>
              <label htmlFor="contact-subject" className="block text-sm font-medium text-slate-700 mb-1.5">
                {t("contact.subjectLabel")}
              </label>
              <Input
                id="contact-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t("contact.subjectPlaceholder")}
                required
                className="rounded-xl border-slate-200 bg-white/90 backdrop-blur-sm"
              />
            </div>
            <div>
              <label htmlFor="contact-message" className="block text-sm font-medium text-slate-700 mb-1.5">
                {t("contact.messageLabel")}
              </label>
              <textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("contact.messagePlaceholder")}
                required
                rows={5}
                className="w-full rounded-xl border border-slate-200 bg-white/90 backdrop-blur-sm px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1"
              />
            </div>
            <Button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-xl bg-white/80 backdrop-blur-md border border-slate-200/80 text-slate-800 font-semibold hover:bg-white/90 shadow-[0_4px_14px_rgba(0,0,0,0.06)]"
            >
              {status === "sending" ? t("contact.sending") : t("contact.submitLabel")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
