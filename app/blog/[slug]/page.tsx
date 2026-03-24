import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getAllBlogMeta, getBlogPostBySlug, markdownToHtml } from "@/lib/blog";

type Params = { slug: string };

export async function generateStaticParams() {
  return getAllBlogMeta().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const post = getBlogPostBySlug(params.slug);
  if (!post) {
    return { title: "記事が見つかりません | SyncTask Blog" };
  }
  return {
    title: `${post.title} | SyncTask Blog`,
    description: post.description,
  };
}

export default function BlogArticlePage({ params }: { params: Params }) {
  const post = getBlogPostBySlug(params.slug);
  if (!post) notFound();
  const html = markdownToHtml(post.content);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          トップへ
        </Link>

        <article className="rounded-2xl border border-slate-100 bg-white/80 backdrop-blur-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] p-6 md:p-10 text-slate-700">
          <p className="text-xs md:text-sm text-slate-500 mb-3">
            公開日: {post.publishedAt}
            {post.updatedAt ? ` / 更新日: ${post.updatedAt}` : ""}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mb-6">{post.title}</h1>
          <p className="text-sm md:text-base text-slate-600 leading-relaxed mb-8">{post.description}</p>

          <div
            className="prose prose-slate max-w-none prose-headings:font-bold prose-h2:mt-8 prose-h2:mb-3 prose-h3:mt-6 prose-h3:mb-2 prose-p:leading-relaxed prose-ul:my-4"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-between gap-3">
            <Link href="/guide" className="text-sm font-medium text-slate-700 hover:text-slate-900">
              初めての方は活用ガイドへ
            </Link>
            <Link href="/contact" className="text-sm font-medium text-slate-700 hover:text-slate-900">
              お問い合わせ
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}

