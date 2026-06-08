import { Search, Clock, CheckCircle2, Mail, AlertCircle } from "lucide-react";

/**
 * Click-preview drawer body for `insurance_precheck`. Side-by-side
 * 4-field form / formatted Stedi response. Bêta status surfaced on
 * the chip via the AddonChip beta badge — no second beta callout
 * inside the drawer to keep the focus on the deliverable shape.
 */
export const InsurancePrecheckPreview = () => (
  <div className="space-y-3">
    <div className="bg-cream-warm rounded-xl border border-ink/10 overflow-hidden">
      <div className="border-b border-ink/10 px-4 py-2.5 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-ink/55 font-mono inline-flex items-center gap-1.5">
          <Search className="w-3 h-3" />
          admin · Eligibility check
        </div>
        <div className="text-[10px] text-sage font-mono inline-flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          8s
        </div>
      </div>

      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-ink/10">
        <div className="p-4 space-y-2 text-xs">
          <div className="text-[10px] uppercase tracking-wider text-ink/45 mb-1">
            Patient details
          </div>
          {[
            { l: "Name", v: "Sofia Martinez" },
            { l: "DOB", v: "1989-06-12" },
            { l: "Member ID", v: "BCB-447829301" },
            { l: "Payer", v: "BCBS TX" },
          ].map((f) => (
            <div key={f.l}>
              <div className="text-[9px] uppercase tracking-wider text-ink/45">
                {f.l}
              </div>
              <div className="text-xs text-ink font-mono bg-white border border-ink/10 rounded px-2 py-1">
                {f.v}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-sage/[0.03]">
          <div className="flex items-center gap-1.5 mb-3">
            <CheckCircle2 className="w-3.5 h-3.5 text-sage" />
            <div className="text-[10px] uppercase tracking-wider text-sage font-mono font-medium">
              Active · In-network
            </div>
          </div>
          <dl className="space-y-1.5 text-xs">
            {[
              { l: "Deductible left", v: "$340 / $1,500" },
              { l: "OOP max", v: "$2,150 / $4,500" },
              { l: "MH copay", v: "$25 / session" },
              { l: "Plan year", v: "2026" },
            ].map((row) => (
              <div key={row.l} className="flex items-baseline justify-between gap-2 pb-1 border-b border-ink/5">
                <dt className="text-[11px] text-ink/60">{row.l}</dt>
                <dd className="text-xs font-medium text-ink font-mono">{row.v}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            className="w-full mt-3 border border-sage/40 bg-white text-sage rounded py-1.5 text-[11px] font-medium inline-flex items-center justify-center gap-1.5"
          >
            <Mail className="w-3 h-3" />
            Send estimation to patient
          </button>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-ink/10 text-[10px] text-ink/55 inline-flex items-center gap-1.5">
        <AlertCircle className="w-3 h-3 text-ink/45" />
        Covers ~80% of US payers — small/regional plans flagged upfront.
      </div>
    </div>

    <div className="text-[11px] text-ink/55 italic leading-relaxed">
      Quick eligibility check — the same result your team sees on the phone.
      Coming soon.
    </div>
  </div>
);
