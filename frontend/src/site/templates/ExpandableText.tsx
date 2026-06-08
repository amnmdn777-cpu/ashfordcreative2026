import { useEffect, useRef, useState } from "react";
import { useI18n } from "@site/lib/i18n";

// Clamps review text to ~7 lines and shows a Show more/less toggle only
// when the content actually overflows. i18n'd via tpl_show_more/_less.
export function ExpandableText({
  text,
  className = "",
  toggleClassName = "",
  lineClampClassName = "line-clamp-[7]",
}: {
  text: string;
  className?: string;
  toggleClassName?: string;
  lineClampClassName?: string;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (expanded) return;
      setOverflows(el.scrollHeight - el.clientHeight > 1);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text, expanded]);

  return (
    <div>
      <p
        ref={ref}
        className={`${expanded ? "" : lineClampClassName} ${className}`}
      >
        {text}
      </p>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`mt-2 text-xs font-medium underline underline-offset-2 hover:no-underline ${toggleClassName}`}
        >
          {expanded ? t("tpl_show_less") : t("tpl_show_more")}
        </button>
      )}
    </div>
  );
}
