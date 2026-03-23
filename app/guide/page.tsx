"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BookOpen, Calendar as CalendarIcon, FileText, ListTodo, Clock, Users, Sparkles } from "lucide-react";

function GuideCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white/80 backdrop-blur-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.06)] p-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
          <Icon className="h-5 w-5 text-slate-800" />
        </div>
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900">{title}</h2>
          <div className="mt-2 text-sm leading-relaxed text-slate-600">{children}</div>
        </div>
      </div>
    </div>
  );
}

function DummyMedia({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-6">
      <div className="flex items-center justify-center h-28 rounded-xl bg-white/70 border border-slate-100">
        <Icon className="h-10 w-10 text-slate-800" aria-hidden />
      </div>
      <p className="mt-3 text-center text-xs font-semibold text-slate-500">{label}</p>
    </div>
  );
}

export default function GuidePage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("legal.backToTop")}
        </Link>

        <article className="rounded-2xl border border-slate-100 bg-white/80 backdrop-blur-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] p-6 md:p-10 text-slate-700">
          <header>
            <div className="flex items-start justify-between gap-4 flex-col md:flex-row md:items-center">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">初めての方向け：SyncTask活用ガイド</h1>
                <p className="mt-3 text-sm md:text-base text-slate-600 leading-relaxed">
                  このガイドでは、SyncTaskで「カレンダー」「ToDo」「多言語翻訳」を最短で使い始める手順をまとめます。
                  迷ったら、下のセクションから順に読み進めてください。
                </p>
              </div>
              <div className="w-full md:w-auto flex items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold bg-slate-50 border border-slate-100 text-slate-700">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  初心者向け
                </span>
              </div>
            </div>
          </header>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
            <DummyMedia icon={CalendarIcon} label="カレンダー連携" />
            <DummyMedia icon={ListTodo} label="ToDo管理" />
            <DummyMedia icon={FileText} label="多言語翻訳" />
            <DummyMedia icon={Clock} label="リマインダー" />
          </div>

          <div className="mt-10 space-y-4">
            <GuideCard icon={Users} title="1. はじめに（ログイン〜準備）">
              <ol className="list-decimal pl-5 space-y-2">
                <li>ログインして、ユーザー名を設定します。</li>
                <li>最初は「マイカレンダー（個人用）」が用意されます。</li>
                <li>共有したい相手がいる場合は、後でカレンダー共有を行います。</li>
              </ol>
            </GuideCard>

            <GuideCard icon={CalendarIcon} title="2. カレンダーの作成と選択">
              カレンダーは「仕事」「家庭」など目的ごとに分けると運用しやすくなります。
              画面上部でカレンダーを切り替えると、選択中のカレンダーに紐づくToDoだけが表示されます。
              必要になったら新しいカレンダーを追加して、タスクを整理しましょう。
            </GuideCard>

            <GuideCard icon={ListTodo} title="3. ToDoの追加・優先度・並び順">
              ToDoは、入力欄から追加して、完了チェックで状況を更新できます。
              優先度（高/中/低）で重要度を揃え、並び順はドラッグ＆ドロップで調整可能です。
              まずは「今日やること」から運用を始めるのがおすすめです。
            </GuideCard>

            <GuideCard icon={FileText} title="4. 多言語翻訳を活用する">
              タスク名は、表示言語に合わせて翻訳されます。
              グローバルなチームや家族でも、言語が違っても同じタスクを追いやすくなります。
              原文が必要なときは、表示側で確認できるので安心してください。
            </GuideCard>

            <GuideCard icon={Clock} title="5. リマインダー（通知と繰り返し）">
              未完了のToDoや期限に気づきやすくするために、リマインダーを設定できます。
              「毎月」「毎日」など、繰り返し運用したいタスクにも対応しています。
              通知が必要な場合は、ブラウザ側の権限も確認してください。
            </GuideCard>

            <GuideCard icon={Users} title="6. 共有して運用を回す">
              カレンダーを共有すると、参加メンバーの状況が見えるようになり、抜け漏れを減らせます。
              まずは1つのカレンダーだけ共有して、運用の手触りをつかむのが近道です。
            </GuideCard>

            <GuideCard icon={CalendarIcon} title="7. すぐ使える運用例">
              たとえば次のように使うと、迷いが減って続きやすくなります。
              <div className="mt-3 space-y-3">
                <p>
                  <span className="font-semibold text-slate-800">仕事（例）</span>
                  <br />
                  毎週のToDoを「優先度：高」で登録し、期限前に通知が届くようリマインダーを設定します。
                </p>
                <p>
                  <span className="font-semibold text-slate-800">家庭（例）</span>
                  <br />
                  月1のタスク（支払い・予約）を繰り返し運用し、完了したら完了チェックで反映します。
                </p>
                <p>
                  <span className="font-semibold text-slate-800">チーム（例）</span>
                  <br />
                  カレンダー共有＋多言語翻訳で、相手の言語が違っても同じタスクを追いやすくします。
                </p>
              </div>
            </GuideCard>

            <GuideCard icon={Sparkles} title="8. うまくいかないときの調整">
              「思った通りに見えない」や「続かない」ときは、まず次を確認してみてください。
              <ol className="list-decimal pl-5 space-y-2 mt-3">
                <li>カレンダーが正しいものに切り替わっているか（表示対象のToDoが変わります）</li>
                <li>優先度の運用ルール（最初は高/中/低を軽く使い分けるだけでOKです）</li>
                <li>翻訳表示の言語にズレがないか（表示言語に合わせて切り替わります）</li>
                <li>通知が必要な場合は、ブラウザ側の通知権限も確認する</li>
              </ol>
              それでも難しい場合は、お問い合わせから状況を教えてください。
            </GuideCard>

            <GuideCard icon={BookOpen} title="困ったとき（よくある質問）">
              <div className="space-y-3">
                <p>
                  Q. 翻訳が反映されないときは？
                  <br />
                  A. 通常は自動で反映されますが、ネットワークや翻訳APIの状態によって遅れることがあります。
                  その場合は時間をおいて再確認してください。
                </p>
                <p>
                  Q. 通知が届かないときは？
                  <br />
                  A. ブラウザの通知権限と、設定画面のリマインダー設定をご確認ください。
                </p>
                <p>
                  Q. どこから始めればいい？
                  <br />
                  A. 「カレンダーを選ぶ → ToDoを追加 → 必要に応じて翻訳とリマインダー」の順で進めるのが一番スムーズです。
                </p>
              </div>
            </GuideCard>
          </div>

          <div className="mt-10 flex items-center justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-slate-800 bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-[0_4px_14px_rgba(0,0,0,0.06)] hover:bg-white/90 hover:border-slate-200 transition-all duration-200"
            >
              お問い合わせも見る
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}

