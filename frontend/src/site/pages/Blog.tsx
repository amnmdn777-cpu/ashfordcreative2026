import { useEffect, useState } from "react";
import { Link } from "wouter";
import type { BlogPostSummary } from "@workspace/api-zod";
import { api, img } from "@site/lib/api";
import { useI18n } from "@site/lib/i18n";
import { Seo } from "@site/lib/seo";
import { PageCTA } from "@site/components/PageCTA";

const COVERS = [
  img("images/blog-cover-1-desk.png"),
  img("images/blog-cover-2-lobby.png"),
  img("images/blog-cover-3-ledger.png"),
  img("images/hero-detail.png"),
  img("images/hero-foundation.png"),
  img("images/hero-ledger.png"),
  img("images/hero-architecture.png"),
  img("images/hero-cornerstone.png"),
];

function fmtDate(s: string, locale: string) {
  try {
    return new Date(s).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return s;
  }
}

export default function Blog() {
  const { t, locale } = useI18n();
  const [posts, setPosts] = useState<
    (BlogPostSummary & { likeCount?: number })[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listBlogPosts()
      .then((d) => setPosts(d.posts))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <>
      <Seo
        title={t("blog_page_title")}
        description={t("blog_page_sub")}
        path="/blog"
      />

      <section className="bg-ink text-cream py-24 px-6 lg:px-12">
        <div className="max-w-5xl mx-auto">
          <h1 className="font-display text-[44px] md:text-[64px] leading-tight mb-6">
            {t("blog_page_title")}
          </h1>
          <p className="font-serif text-[20px] md:text-[24px] leading-[1.55] text-cream/80 max-w-3xl">
            {t("blog_page_sub")}
          </p>
        </div>
      </section>

      <section className="py-20 px-6 lg:px-12 bg-cream">
        <div className="max-w-7xl mx-auto">
          {error && (
            <div className="text-red-700 bg-red-50 border border-red-200 p-4 rounded mb-6">
              {error}
            </div>
          )}
          {posts === null && !error && (
            <div className="text-ink/60 text-center py-16">{t("loading")}</div>
          )}
          {posts && posts.length === 0 && (
            <div className="text-ink/60 text-center py-16">
              {t("blog_no_articles")}
            </div>
          )}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
            {posts?.map((p, i) => (
              <Link
                key={p.id}
                href={`/blog/${p.slug}`}
                className="block group cursor-pointer"
              >
                <div className="aspect-[4/3] overflow-hidden bg-paper mb-5 rounded-sm">
                  <img
                    src={p.heroImage || COVERS[i % COVERS.length]}
                    alt={p.title}
                    className="w-full h-full object-cover mix-blend-multiply opacity-90 group-hover:scale-[1.03] transition-transform duration-700"
                  />
                </div>
                <div className="font-mono text-[10px] tracking-widest uppercase text-sage mb-2">
                  {p.authorName} · {fmtDate(p.publishedAt, locale)}
                </div>
                <h2 className="font-display text-2xl text-ink leading-snug mb-2 group-hover:text-sage transition-colors">
                  {p.title}
                </h2>
                <p className="text-sm text-ink/70 leading-relaxed line-clamp-3">
                  {p.excerpt}
                </p>
                {typeof p.likeCount === "number" && (
                  <div className="mt-3 text-xs text-ink/50 font-mono">
                    ♥ {p.likeCount}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <PageCTA />
    </>
  );
}
