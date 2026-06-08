import { Video, FileSignature, GraduationCap, ShieldCheck, CreditCard } from "lucide-react";

/**
 * Click-preview drawer body for `telehealth_full`. Compact 4-step
 * concierge timeline + single-invoice reassurance. Telehealth Bridge
 * is included so the prospect sees the bundled scope.
 */
export const TelehealthFullPreview = () => {
  const steps = [
    { Icon: Video, t: "Doxy.me Pro account created", s: "Connect your existing HIPAA-compliant telehealth tool" },
    { Icon: FileSignature, t: "BAA signed in 2 min", s: "We email it, you e-sign — only legal step" },
    { Icon: GraduationCap, t: "30-min onboarding session", s: "Practice with our team, not a real patient" },
    { Icon: ShieldCheck, t: "Branded /visit page wired", s: "Telehealth Bridge included" },
  ];
  return (
    <div className="space-y-3">
      <div className="bg-cream-warm rounded-xl border border-ink/10 p-5 sm:p-6">
        <div className="text-[10px] uppercase tracking-widest text-sage font-mono mb-4">
          What we deliver in 5 business days
        </div>
        <ol className="space-y-2.5">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-sage/15 text-sage flex items-center justify-center shrink-0">
                <step.Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 pt-0.5">
                <div className="text-xs font-medium text-ink">{step.t}</div>
                <div className="text-[11px] text-ink/55">{step.s}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 pt-4 border-t border-ink/10 flex items-start gap-2 text-[11px] text-ink/65 leading-relaxed">
          <CreditCard className="w-3.5 h-3.5 text-sage mt-0.5 shrink-0" />
          Single monthly invoice — Doxy.me Pro billed on our card, you
          never see it. $149 one-time setup covers concierge onboarding,
          BAA, and your first 30-min training session.
        </div>
      </div>

      <div className="text-[11px] text-ink/55 italic leading-relaxed">
        For practices without a telehealth account yet. If you already
        have Doxy / Zoom, the $25/mo Bridge is the right fit.
      </div>
    </div>
  );
};
