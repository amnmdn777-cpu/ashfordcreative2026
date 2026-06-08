/**
 * [CLEANUP D.4] Editor form — type the article by hand.
 *
 * Title (auto-slugged with manual override), body EN, body ES,
 * meta description. Save draft = persists the row; Publish flips
 * status to 'published' so the practitioner's public site can
 * render it.
 *
 * Pure paste-and-publish — every word is typed by the editor.
 */
import { useEffect, useMemo, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@admin/lib/api";
import { PageHeader } from "@admin/components/AdminLayout";

type DetailResponse = {
  schedule: {
    id: number;
    leadId: number;
    dueDate: string;
    topicHint: string | null;
    status: "pending" | "written" | "skipped";
    notes: string | null;
  };
  lead: {
    id: number;
    name: string;
    practice: string | null;
    specialty: string;
    city: string;
  };
  post: {
    id: number;
    status: "draft" | "published";
    title: string;
    slug: string;
    bodyEn: string;
    bodyEs: string;
    metaDescription: string | null;
    publishedAt: string | null;
  } | null;
};

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

export default function EditorialEditPage() {
  const [, params] = useRoute<{ scheduleId: string }>(
    "/editorial/:scheduleId/edit",
  );
  const [, navigate] = useLocation();
  const scheduleId = Number(params?.scheduleId);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "editorial", "detail", scheduleId],
    queryFn: () =>
      request<DetailResponse>(`/admin/editorial/${scheduleId}`),
    enabled: Number.isFinite(scheduleId) && scheduleId > 0,
  });

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [bodyEn, setBodyEn] = useState("");
  const [bodyEs, setBodyEs] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const p = data.post;
    setTitle(p?.title ?? "");
    setSlug(p?.slug ?? "");
    setSlugDirty(Boolean(p?.slug));
    setBodyEn(p?.bodyEn ?? "");
    setBodyEs(p?.bodyEs ?? "");
    setMetaDescription(p?.metaDescription ?? "");
  }, [data]);

  // Auto-slug from title until user manually edits the slug field.
  useEffect(() => {
    if (!slugDirty) setSlug(slugify(title));
  }, [title, slugDirty]);

  const save = useMutation({
    mutationFn: (publish: boolean) =>
      request<{ post: DetailResponse["post"] }>(
        `/admin/editorial/${scheduleId}/save`,
        {
          method: "POST",
          body: JSON.stringify({
            title,
            slug,
            bodyEn,
            bodyEs,
            metaDescription: metaDescription || null,
            publish,
          }),
        },
      ),
    onSuccess: (resp, publish) => {
      setStatusMsg(publish ? "Published." : "Draft saved.");
      qc.invalidateQueries({ queryKey: ["admin", "editorial"] });
    },
    onError: (err: Error) => {
      setStatusMsg(`Failed: ${err.message}`);
    },
  });

  const disabled = save.isPending || !title.trim() || !slug.trim();

  const headerSubtitle = useMemo(() => {
    if (!data) return "";
    return `${data.lead.name} · ${data.lead.specialty} · ${data.lead.city} · due ${data.schedule.dueDate}`;
  }, [data]);

  if (!Number.isFinite(scheduleId) || scheduleId <= 0) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto">
        <p className="text-sm text-destructive">Invalid schedule id.</p>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto">
      <PageHeader
        title="Write article"
        description={headerSubtitle}
        actions={
          <button
            type="button"
            onClick={() => navigate("/editorial")}
            className="text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground"
          >
            ← Back to queue
          </button>
        }
      />

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="text-sm text-destructive">
          Failed: {(error as Error).message}
        </p>
      )}

      {data && (
        <div className="space-y-6">
          {data.schedule.topicHint && (
            <div className="bg-card border border-card-border rounded-lg p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Topic
              </div>
              <div className="text-sm text-foreground">
                {data.schedule.topicHint}
              </div>
            </div>
          )}

          <Field label="Title">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              maxLength={256}
            />
          </Field>

          <Field
            label="Slug"
            hint="Auto-filled from the title until you edit it."
          >
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugDirty(true);
              }}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background font-mono"
              maxLength={160}
            />
          </Field>

          <Field label="Body (English)">
            <textarea
              value={bodyEn}
              onChange={(e) => setBodyEn(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              rows={14}
            />
          </Field>

          <Field label="Body (Spanish)">
            <textarea
              value={bodyEs}
              onChange={(e) => setBodyEs(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              rows={14}
            />
          </Field>

          <Field
            label="Meta description"
            hint="Shown in search results. Keep under 160 characters."
          >
            <input
              type="text"
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              maxLength={320}
            />
          </Field>

          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              disabled={disabled}
              onClick={() => save.mutate(false)}
              className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => save.mutate(true)}
              className="px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              Publish
            </button>
            {data.post?.status === "published" && (
              <span className="text-xs text-muted-foreground">
                Currently published
                {data.post.publishedAt ? ` · ${data.post.publishedAt}` : ""}
              </span>
            )}
            {statusMsg && (
              <span className="text-xs text-muted-foreground">
                {statusMsg}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
        {label}
      </label>
      {children}
      {hint && (
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      )}
    </div>
  );
}
