import Link from "next/link";
import { ArrowLeft, BookOpenText } from "lucide-react";
import { getAllBlogMeta } from "@/lib/blog";

export const metadata = {
  title: "SyncTask Blog",
  description: "SyncTask の運用ノウハウ、開発知見、AdSense 審査に役立つ情報を発信します。",
};

export default function BlogIndexPage() {
  const posts = getAllBlogMeta();

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          トップへ
        </Link>

        <section className="rounded-2xl border border-slate-100 bg-white/80 backdrop-blur-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] p-6 md:p-10">
          <div className="flex items-center gap-2 mb-2">
            <BookOpenText className="h-5 w-5 text-slate-800" />
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">SyncTask Blog</h1>
          </div>
          <p className="text-sm md:text-base text-slate-600 mb-8">
            プロダクト活用、ワークフロー設計、Web運用に関する専門記事を掲載しています。
          </p>

          <div className="space-y-4">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="rounded-xl border border-slate-100 bg-white/70 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.08)] p-5"
              >
                <p className="text-xs text-slate-500">{post.publishedAt}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">{post.title}</h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{post.description}</p>
                <Link
                  href={`/blog/${post.slug}`}
                  className="inline-flex mt-3 text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  続きを読む
                </Link>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

