import { Instagram, Linkedin, Facebook, Music2, EyeOff } from "lucide-react";

/**
 * Click-preview drawer body for the `social_row` default feature.
 * Renders a footer-style dark band with the four most common platforms,
 * each as a circular icon + handle. The "hide" toggle row underneath
 * makes the on/off-per-platform story explicit — practices with no
 * TikTok presence shouldn't ever see that icon ghosted in their footer.
 */

const SocialChip = ({
  Icon,
  label,
  handle,
  active,
}: {
  Icon: typeof Instagram;
  label: string;
  handle: string;
  active: boolean;
}) => (
  <a
    className={
      "group flex items-center gap-2 rounded-full px-3 py-2 transition-colors " +
      (active
        ? "bg-cream/10 hover:bg-cream/15 text-cream"
        : "bg-cream/5 text-cream/30 cursor-not-allowed")
    }
    href="#"
    onClick={(e) => e.preventDefault()}
  >
    <Icon className="w-3.5 h-3.5" />
    <span className="text-[11px] font-mono">{handle}</span>
    {!active && <EyeOff className="w-3 h-3 ml-1" />}
  </a>
);

export const SocialRowPreview = () => {
  const platforms = [
    { Icon: Instagram, label: "Instagram", handle: "@drmaya.lcsw", active: true },
    { Icon: Linkedin, label: "LinkedIn", handle: "in/maya-alvarado", active: true },
    { Icon: Facebook, label: "Facebook", handle: "drmayaalvarado", active: true },
    { Icon: Music2, label: "TikTok", handle: "—", active: false },
  ];

  return (
    <div className="space-y-3">
      {/* Footer mock */}
      <div className="bg-ink rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-cream/10">
          <div className="flex items-center justify-between">
            <div className="font-display text-cream text-sm">
              Dr. Maya Alvarado, LCSW
            </div>
            <span className="text-[10px] uppercase tracking-widest text-cream/45 font-mono">
              Footer · live preview
            </span>
          </div>
          <div className="text-[11px] text-cream/55 mt-1">
            318 W 6th St, Austin, TX · (512) 555-1812
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-[10px] uppercase tracking-widest text-cream/45 font-mono mb-3">
            Find the practice on
          </div>
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => (
              <SocialChip key={p.label} {...p} />
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-cream/10 flex items-center justify-between text-[10px] text-cream/40 font-mono">
          <span>© 2026 Maya Alvarado, LCSW</span>
          <span>Built with care · Ashford</span>
        </div>
      </div>

      {/* Toggle explainer */}
      <div className="bg-cream-warm rounded-xl border border-ink/10 p-4">
        <div className="text-[10px] uppercase tracking-widest text-ink/55 font-mono mb-2">
          You control which icons render
        </div>
        <ul className="space-y-1.5 text-[12px] text-ink/80">
          {platforms.map((p) => (
            <li key={p.label} className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <p.Icon className="w-3.5 h-3.5 text-ink/55" />
                {p.label}
              </span>
              <span
                className={
                  "inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-mono " +
                  (p.active ? "text-sage" : "text-ink/35")
                }
              >
                <span
                  className={
                    "w-1.5 h-1.5 rounded-full " +
                    (p.active ? "bg-sage" : "bg-ink/25")
                  }
                />
                {p.active ? "Visible" : "Hidden"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-[11px] text-ink/55 italic leading-relaxed">
        We never display an icon for a profile you don't actually keep up.
        An empty Instagram feed at the bottom of a therapy site reads as
        abandoned — better to not show it at all.
      </div>
    </div>
  );
};
