import { Suspense, lazy, useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { Heart, ArrowLeft } from "lucide-react";

// Lazy-load `react-markdown` (+ remark) so it only ships to visitors
// who actually open a blog post — the package is ~40KB gzip and
// nothing else on the marketing surface uses it. The fallback is the
// raw markdown string itself, which renders as readable text while
// the component loads (most blog posts open with a paragraph, not a
// heading, so this looks intentional rather than broken).
const ReactMarkdown = lazy(() => import("react-markdown"));
import type { BlogCommentDto, BlogPostFull } from "@workspace/api-zod";
import { api } from "@site/lib/api";
import { useI18n } from "@site/lib/i18n";
import { Seo } from "@site/lib/seo";

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

function fmtRelative(s: string, locale: string) {
  try {
    const then = new Date(s).getTime();
    const diffSec = Math.round((then - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(locale === "es" ? "es" : "en", {
      numeric: "auto",
    });
    const abs = Math.abs(diffSec);
    if (abs < 60) return rtf.format(diffSec, "second");
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
    if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), "day");
    if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), "month");
    return rtf.format(Math.round(diffSec / 31536000), "year");
  } catch {
    return s;
  }
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { t, locale } = useI18n();
  const [post, setPost] = useState<BlogPostFull | null>(null);
  const [comments, setComments] = useState<BlogCommentDto[]>([]);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [liked, setLiked] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState({ name: "", practice: "", body: "" });

  useEffect(() => {
    if (!slug) return;
    api
      .getBlogPost(slug)
      .then((d) => {
        setPost(d.post);
        setComments(d.comments);
        setLikeCount(d.likes ?? 0);
        const likedKey = `liked:${slug}`;
        if (localStorage.getItem(likedKey) === "1") setLiked(true);
      })
      .catch((e: Error) => setErr(e.message));
  }, [slug]);

  async function like() {
    if (!slug || liked) return;
    try {
      const r = await api.likeBlogPost(slug);
      setLikeCount(r.likes);
      setLiked(true);
      localStorage.setItem(`liked:${slug}`, "1");
    } catch {
      // best-effort
    }
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !form.name.trim() || form.body.trim().length < 2) return;
    setPosting(true);
    try {
      const r = await api.postBlogComment(slug, {
        authorName: form.name.trim(),
        authorPractice: form.practice.trim() || undefined,
        body: form.body.trim(),
      });
      setComments((c) => [r.comment, ...c]);
      setForm({ name: "", practice: "", body: "" });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPosting(false);
    }
  }

  if (err && !post) {
    return (
      <div className="px-6 py-32 text-center">
        <p className="font-display text-2xl text-ink mb-4">{err}</p>
        <Link href="/blog" className="text-sage underline">
          {t("blog_back")}
        </Link>
      </div>
    );
  }
  if (!post) return <div className="px-6 py-32 text-center text-ink/60">Loading…</div>;

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: post.heroImage || undefined,
    author: { "@type": "Person", name: post.authorName },
    datePublished: post.publishedAt,
    publisher: {
      "@type": "Organization",
      name: "Ashford Creative",
    },
  };

  return (
    <>
      <Seo
        title={post.title}
        description={post.excerpt}
        path={`/blog/${post.slug}`}
        type="article"
        jsonLd={articleLd}
      />

      <article className="bg-cream">
        <header className="bg-ink text-cream pt-16 pb-12 px-6 lg:px-12">
          <div className="max-w-3xl mx-auto">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-cream/70 hover:text-gold text-sm font-mono uppercase tracking-widest mb-8"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> {t("blog_back")}
            </Link>
            <div className="font-mono text-[10px] tracking-widest uppercase text-gold mb-4">
              {post.authorName} · {fmtDate(post.publishedAt, locale)}
            </div>
            <h1 className="font-display text-[40px] md:text-[64px] leading-[1.05] mb-6">
              {post.title}
            </h1>
            <p className="font-serif text-[20px] md:text-[22px] leading-[1.55] text-cream/85">
              {post.excerpt}
            </p>
          </div>
        </header>

        {post.heroImage && (
          <div className="max-w-5xl mx-auto px-6 lg:px-12 -mt-8 mb-12">
            <img
              src={post.heroImage}
              alt={post.title}
              className="w-full aspect-[16/9] object-cover rounded-sm shadow-md"
            />
          </div>
        )}

        <div className="max-w-3xl mx-auto px-6 lg:px-12 pb-16">
          <div className="prose-ashford">
            <Suspense
              fallback={
                <div className="whitespace-pre-wrap text-ink/80">
                  {post.bodyMd}
                </div>
              }
            >
              <ReactMarkdown>{post.bodyMd}</ReactMarkdown>
            </Suspense>
          </div>

          <div className="mt-12 pt-8 border-t border-ink/10 flex items-center gap-4">
            <button
              onClick={like}
              disabled={liked}
              className={
                "flex items-center gap-2 px-4 py-2 rounded-full border transition-colors text-sm " +
                (liked
                  ? "bg-sage/10 border-sage text-sage"
                  : "border-ink/20 text-ink/70 hover:border-sage hover:text-sage")
              }
            >
              <Heart
                className={"w-4 h-4 " + (liked ? "fill-sage" : "")}
              />
              <span>
                {likeCount} {t("blog_likes")}
              </span>
            </button>
          </div>
        </div>
      </article>

      {/* COMMENTS */}
      <section className="bg-cream-warm py-16 px-6 lg:px-12 border-t border-ink/10">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl text-ink mb-6">
            {t("blog_comments_title")}
          </h2>

          <div className="space-y-4 mb-10">
            {comments.length === 0 && (
              <div className="text-ink/55 italic">{t("blog_no_comments")}</div>
            )}
            {comments.map((c) => (
              <div
                key={c.id}
                className="bg-paper border border-ink/10 rounded-sm p-5"
              >
                <div className="flex justify-between items-baseline gap-3 mb-2">
                  <div>
                    <span className="font-display text-lg text-ink">
                      {c.authorName}
                    </span>
                    {c.authorPractice && (
                      <span className="text-sm text-ink/55 ml-2">
                        · {c.authorPractice}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-ink/45">
                    {fmtRelative(c.createdAt, locale)}
                  </span>
                </div>
                <p className="text-[15px] text-ink/85 leading-relaxed font-serif">
                  {c.body}
                </p>
              </div>
            ))}
          </div>

          <form onSubmit={postComment} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                required
                placeholder={t("blog_comment_name")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-ink/15 bg-paper text-sm rounded-md focus:outline-none focus:border-sage"
              />
              <input
                placeholder={t("blog_comment_practice")}
                value={form.practice}
                onChange={(e) => setForm({ ...form, practice: e.target.value })}
                className="w-full px-3 py-2 border border-ink/15 bg-paper text-sm rounded-md focus:outline-none focus:border-sage"
              />
            </div>
            <textarea
              required
              minLength={2}
              rows={3}
              placeholder={t("blog_comment_body")}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="w-full px-3 py-2 border border-ink/15 bg-paper text-sm rounded-md focus:outline-none focus:border-sage resize-none"
            />
            <button
              type="submit"
              disabled={posting}
              className="px-5 py-2 bg-ink text-cream text-sm font-medium rounded-md hover:bg-sage-light transition-colors disabled:opacity-60"
            >
              {posting ? t("sending") : t("blog_comment_submit")}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
