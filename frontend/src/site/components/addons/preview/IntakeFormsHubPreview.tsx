import { ClipboardList, FileSignature, Lock, Smartphone } from "lucide-react";

/**
 * Click-preview drawer body for `intake_forms_hub`. Renders a faux
 * mobile-form view (the patient experience) plus a small "what you
 * get back" panel on the front-desk side.
 */
export const IntakeFormsHubPreview = () => {
  const forms = [
    { label: "Intake Questionnaire", state: "signed" },
    { label: "Informed Consent", state: "signed" },
    { label: "Telehealth Consent", state: "signed" },
    { label: "Sliding-Scale Application", state: "pending" },
    { label: "Release of Records", state: "skipped" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-[260px,1fr] gap-3">
        {/* Phone mockup */}
        <div className="bg-ink-deep rounded-[28px] p-2 shadow-xl mx-auto sm:mx-0">
          <div className="bg-cream rounded-[22px] overflow-hidden">
            <div className="bg-sage text-cream px-4 py-3 flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5" />
              <span className="text-[11px] font-mono uppercase tracking-widest">
                drmaya.com / forms
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-[10px] uppercase tracking-widest text-sage font-mono">
                Step 3 of 4
              </div>
              <div className="text-sm font-medium text-ink leading-tight">
                Have you been in therapy before?
              </div>
              <div className="space-y-1.5">
                {["Yes — currently", "Yes — in the past", "No"].map((opt, i) => (
                  <button
                    key={opt}
                    type="button"
                    className={
                      "w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors " +
                      (i === 1
                        ? "border-sage bg-sage/5 text-sage font-medium"
                        : "border-ink/15 text-ink/80")
                    }
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div className="pt-2 border-t border-ink/5 flex items-center justify-between">
                <Lock className="w-3 h-3 text-ink/40" />
                <button
                  type="button"
                  className="text-[11px] bg-ink text-cream px-3 py-1.5 rounded-md font-medium"
                >
                  Sign &amp; continue
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Form library */}
        <div className="bg-cream-warm rounded-xl border border-ink/10 p-4">
          <div className="text-[11px] uppercase tracking-widest text-ink/55 font-mono mb-2.5 inline-flex items-center gap-1.5">
            <ClipboardList className="w-3 h-3" />
            Sarah's form library
          </div>
          <ul className="space-y-2">
            {forms.map((f) => (
              <li
                key={f.label}
                className="flex items-center justify-between gap-3 text-sm border-b border-ink/5 pb-1.5 last:border-0"
              >
                <span
                  className={
                    f.state === "skipped" ? "text-ink/40 line-through" : "text-ink/85"
                  }
                >
                  {f.label}
                </span>
                <span
                  className={
                    "text-[10px] uppercase tracking-widest font-mono " +
                    (f.state === "signed"
                      ? "text-sage"
                      : f.state === "pending"
                        ? "text-gold"
                        : "text-ink/35")
                  }
                >
                  {f.state}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="text-[11px] text-ink/55 italic leading-relaxed inline-flex items-center gap-1.5">
        <FileSignature className="w-3 h-3" />
        Signed PDFs auto-filed in your secure drawer. EN + ES versions
        of every standard form included.
      </div>
    </div>
  );
};
