import React from "react";

/**
 * Hero / portrait `<picture>` wrapper with WebP + JPG fallback.
 *
 * Pass a `src` *without* extension — the component appends `@1x.webp`,
 * `@2x.webp`, and `.jpg` per the `scripts/optimize-hero-photos.ts`
 * output convention. Browsers that support WebP (every modern target)
 * pick the @2x variant on retina screens via the `srcSet` density
 * descriptor; older browsers fall through to the `.jpg`.
 *
 * Use `eager` for above-the-fold imagery (hero + the persona portrait
 * the template renders inside `<About>` when the visitor lands at the
 * top of a template page). Off-screen images keep the default lazy
 * loading.
 */
export interface ResponsivePictureProps {
  /** Path WITHOUT extension. Component appends @1x.webp, @2x.webp, .jpg. */
  src: string;
  alt: string;
  className?: string;
  /** Wrapper className applied to the <picture> element itself. */
  pictureClassName?: string;
  /** Mark the inner <img> as eager + fetchPriority="high" (LCP candidate). */
  eager?: boolean;
  /** Inline style passed to the <img>. */
  style?: React.CSSProperties;
  /** Optional width / height attributes (helps the browser reserve layout). */
  width?: number;
  height?: number;
}

export function ResponsivePicture({
  src,
  alt,
  className = "",
  pictureClassName = "",
  eager = false,
  style,
  width,
  height,
}: ResponsivePictureProps) {
  const [failed, setFailed] = React.useState(false);

  // Empty src or load failure → render a soft-colored placeholder
  // panel instead of a broken-image icon. The container uses
  // `--color-surface-soft` so it disappears into the surrounding
  // template palette (vs. a stark white box). Used by the polaroid
  // stack on previews where the original photo assets weren't
  // deployed — we never want to ship a 404 image to a prospect.
  if (!src || failed) {
    return (
      <span
        className={`${className} inline-flex items-center justify-center`}
        style={{
          ...style,
          backgroundColor: "var(--color-surface-soft, #f5f1ea)",
          color: "var(--color-text-muted, rgba(0,0,0,0.4))",
          fontSize: "0.7rem",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          minHeight: 80,
          width: width ?? "100%",
          height: height ?? "100%",
        }}
        role="img"
        aria-label={alt}
      >
        photo
      </span>
    );
  }

  const webp1x = `${src}@1x.webp`;
  const webp2x = `${src}@2x.webp`;
  const jpg = `${src}.jpg`;

  return (
    <picture className={pictureClassName}>
      <source
        type="image/webp"
        srcSet={`${webp1x} 1x, ${webp2x} 2x`}
      />
      <img
        src={jpg}
        alt={alt}
        className={className}
        style={style}
        width={width}
        height={height}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
        onError={() => setFailed(true)}
      />
    </picture>
  );
}

export default ResponsivePicture;
