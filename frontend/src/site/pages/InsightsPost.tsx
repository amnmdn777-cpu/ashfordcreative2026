/**
 * [CLEANUP D.7] Public per-practitioner Insights Journal post.
 *
 * /insights/:postId renders one human-written, editor-published article.
 * EN/ES body is selected from the current locale. SEO title +
 * meta_description are derived from the post.
 *
 * The practitioner's words, on the record — typed by their editor.
 */
import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useI18n } from "@site/lib/i18n";
import { Seo } from "@site/lib/seo";

type EditorialPost = {
  id: number;
  leadId: number;
  slug: string;
  title: string;
  bodyEn: string;
  bodyEs: string;
  metaDescription: string | null;
  publishedAt: string | null;
};

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ||
  "/api";

export default function InsightsPost() {
  const [, params] = useRoute<{ postId: string }>("/insights/:postId");
  const { locale } = useI18n();
  const [post, setPost] = useState<EditorialPost | null>(null);
  const [error, setError] = useState<string | null>(null);

  const postId = Number(params?.postId);

  useEffect(() => {
    if (!Number.isFinite(postId) || postId <= 0) {
      setError("Not found");
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE}/editorial/posts/${postId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { post: EditorialPost };
        if (!cancelled) setPost(data.post);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (error) {
    return (
      <section className="py-24 px-6 max-w-3xl mx-auto">
        <p className="text-ink/70">Article not available.</p>
      </section>
    );
  }
  if (!post) {
    return (
      <section className="py-24 px-6 max-w-3xl mx-auto">
        <p className="text-ink/60">Loading…</p>
      </section>
    );
  }

  const body = locale === "es" && post.bodyEs ? post.bodyEs : post.bodyEn;
  const description = post.metaDescription ?? body.slice(0, 160);

  return (
    <>
      <Seo
        title={post.title}
        description={description}
        path={`/insights/${post.id}`}
      />
      <article className="py-20 md:py-24 px-6 lg:px-12 bg-cream">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-[36px] md:text-[52px] leading-tight text-ink mb-4">
            {post.title}
          </h1>
          {post.publishedAt && (
            <div className="text-sm text-ink/60 mb-8">
              {new Date(post.publishedAt).toLocaleDateString(
                locale === "es" ? "es-MX" : "en-US",
                { year: "numeric", month: "long", day: "numeric" },
              )}
            </div>
          )}
          <div className="font-serif text-[18px] md:text-[20px] leading-[1.7] text-ink whitespace-pre-wrap">
            {body}
          </div>
        </div>
      </article>
    </>
  );
}
