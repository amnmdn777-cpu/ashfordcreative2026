import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@rep/components/RepLayout";

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 md:p-6">
      <h2 className="font-serif text-lg md:text-xl mb-4 text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function InvoiceLine({ label, amount, sub, bold, separator }: {
  label: string; amount: string; sub?: string; bold?: boolean; separator?: boolean;
}) {
  return (
    <>
      {separator && <tr><td colSpan={2} className="py-1"><div className="border-t border-border" /></td></tr>}
      <tr className={bold ? "font-semibold" : ""}>
        <td className={`py-1.5 pr-4 text-sm ${bold ? "text-foreground" : "text-foreground/80"}`}>
          {label}
          {sub && <div className="text-xs text-muted-foreground font-normal">{sub}</div>}
        </td>
        <td className={`py-1.5 text-right text-sm tabular-nums ${bold ? "text-primary" : "text-foreground/80"}`}>{amount}</td>
      </tr>
    </>
  );
}

const ADDON_OPTIONS = [
  { label: "Base only — no add-ons", value: 0 },
  { label: "Light ($10–$20 in add-ons)", value: 15 },
  { label: "Medium ($30–$50 in add-ons)", value: 40 },
  { label: "Heavy ($75–$100 in add-ons)", value: 85 },
  { label: "Full bundle ($120 add-ons)", value: 120 },
];

function EarningsCalculator() {
  const [closesPerWeek, setClosesPerWeek] = useState(3);
  const [addonIdx, setAddonIdx] = useState(0);

  const addonPerClose = ADDON_OPTIONS[addonIdx].value;
  const CLOSING_BONUS = 149;

  const weeklyClosingBonus = closesPerWeek * CLOSING_BONUS;
  const weeklyAddonBonus = closesPerWeek * addonPerClose;
  const weeklyBonusTotal = weeklyClosingBonus + weeklyAddonBonus;

  const monthlyCloses = closesPerWeek * 4;
  const monthlyClosingBonus = monthlyCloses * CLOSING_BONUS;
  const monthlyAddonBonus = monthlyCloses * addonPerClose;
  const monthlyBonusTotal = monthlyClosingBonus + monthlyAddonBonus;

  return (
    <div className="bg-card border border-card-border rounded-xl p-5 md:p-6">
      <h2 className="font-serif text-lg md:text-xl mb-4">Earnings Calculator</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Estimates bonuses only. Add your hourly earnings (tracked via Overpass) on top.
      </p>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Closes per week: <span className="text-primary font-serif text-xl ml-1">{closesPerWeek}</span>
          </label>
          <input
            type="range"
            min={0}
            max={10}
            value={closesPerWeek}
            onChange={(e) => setClosesPerWeek(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0</span><span>5</span><span>10</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Average add-ons per close</label>
          <select
            value={addonIdx}
            onChange={(e) => setAddonIdx(Number(e.target.value))}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
          >
            {ADDON_OPTIONS.map((opt, i) => (
              <option key={i} value={i}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-muted rounded-xl p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">This week</div>
          <div className="font-serif text-3xl text-primary mb-1">${weeklyBonusTotal}</div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between"><span>Closing bonuses</span><span>${weeklyClosingBonus}</span></div>
            <div className="flex justify-between"><span>Add-on bonuses</span><span>${weeklyAddonBonus}</span></div>
          </div>
        </div>
        <div className="bg-primary text-primary-foreground rounded-xl p-4">
          <div className="text-xs text-primary-foreground/70 uppercase tracking-wide mb-2">This month</div>
          <div className="font-serif text-3xl mb-1">${monthlyBonusTotal.toLocaleString()}</div>
          <div className="space-y-1 text-xs text-primary-foreground/80">
            <div className="flex justify-between"><span>Closing bonuses</span><span>${monthlyClosingBonus.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Add-on bonuses</span><span>${monthlyAddonBonus.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>{monthlyCloses} closes total</span><span></span></div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        + Custom dev commission: 10% of any custom project that closes through you (logged separately).
      </p>
    </div>
  );
}

export default function PaymentPlans() {
  const [location] = useLocation();
  const backHref = location.startsWith("/kb") ? "/kb" : "/resources";

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft size={14} /> Back
      </Link>

      <PageHeader
        title="Payment Plans & Examples"
        description="How client billing works, what your earnings look like, and example invoices."
      />

      <div className="space-y-4">

        <SectionBlock title="How Client Billing Works">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="border-2 border-primary rounded-xl p-4 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-medium">Plan A — Lead with this</span>
              </div>
              <div className="font-serif text-2xl mb-0.5">$0 setup</div>
              <div className="text-primary font-medium text-sm mb-3">+ $199/mo</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We register a fresh domain. Client pays only the first month at checkout. <strong>No upfront cost means no hesitation.</strong> This is the easiest close — lead with it every time.
              </p>
            </div>
            <div className="border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-medium">Plan B</span>
              </div>
              <div className="font-serif text-2xl mb-0.5">$299 setup</div>
              <div className="text-muted-foreground font-medium text-sm mb-3">+ $199/mo</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Client brings their existing domain. Higher first-month payment — use when they specifically want to keep their current URL.
              </p>
            </div>
          </div>
        </SectionBlock>

        <SectionBlock title="Client Invoice Examples">
          <div className="grid md:grid-cols-2 gap-4">

            <div className="border-2 border-primary/40 rounded-xl overflow-hidden">
              <div className="bg-primary/10 px-4 py-2 text-xs font-medium border-b border-primary/20 flex items-center justify-between">
                <span>Plan A — Base Only (Month 1)</span>
                <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Best for cold closes</span>
              </div>
              <div className="p-4">
                <table className="w-full">
                  <tbody>
                    <InvoiceLine label="Base plan — Month 1" sub="Design, hosting, SSL, backups, Spanish, crisis widget" amount="$199.00" />
                    <InvoiceLine label="" amount="" separator />
                    <InvoiceLine label="Total at checkout" amount="$199.00" bold />
                  </tbody>
                </table>
                <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded p-2.5 text-xs text-emerald-700">
                  <strong>Your earnings:</strong> $149 closing bonus + $0 add-ons = <strong>$149</strong>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-xl overflow-hidden">
              <div className="bg-muted px-4 py-2 text-xs font-medium border-b border-border">
                Plan A — With Add-ons (Month 1)
              </div>
              <div className="p-4">
                <table className="w-full">
                  <tbody>
                    <InvoiceLine label="Base plan — Month 1" amount="$199.00" />
                    <InvoiceLine label="Online Booking" amount="$20.00" />
                    <InvoiceLine label="Insurance & Sliding Scale Badge" amount="$15.00" />
                    <InvoiceLine label="" amount="" separator />
                    <InvoiceLine label="Total at checkout" amount="$234.00" bold />
                  </tbody>
                </table>
                <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded p-2.5 text-xs text-emerald-700">
                  <strong>Your earnings:</strong> $149 closing bonus + $35 add-on bonus = <strong>$184</strong>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-xl overflow-hidden">
              <div className="bg-muted px-4 py-2 text-xs font-medium border-b border-border">
                Plan A — Full Add-on Bundle (Month 1)
              </div>
              <div className="p-4">
                <table className="w-full">
                  <tbody>
                    <InvoiceLine label="Base plan — Month 1" amount="$199.00" />
                    <InvoiceLine label="All add-ons bundle" sub="Booking, Insurance Badge, First-Visit Video, Insights Journal, Google Profile Sync, Welcome Kit, Intake Forms Hub, Cancellation Self-Serve" amount="$120.00" />
                    <InvoiceLine label="" amount="" separator />
                    <InvoiceLine label="Total at checkout" amount="$319.00" bold />
                  </tbody>
                </table>
                <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded p-2.5 text-xs text-emerald-700">
                  <strong>Your earnings:</strong> $149 closing bonus + $120 add-on bonus = <strong>$269</strong>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-xl overflow-hidden">
              <div className="bg-muted px-4 py-2 text-xs font-medium border-b border-border">
                Plan B — With Light Add-ons (Month 1)
              </div>
              <div className="p-4">
                <table className="w-full">
                  <tbody>
                    <InvoiceLine label="Plan B setup fee" sub="One-time for BYOD migration" amount="$299.00" />
                    <InvoiceLine label="Base plan — Month 1" amount="$199.00" />
                    <InvoiceLine label="New Patient Welcome Kit" amount="$10.00" />
                    <InvoiceLine label="Cancellation Self-Serve" amount="$10.00" />
                    <InvoiceLine label="" amount="" separator />
                    <InvoiceLine label="Total at checkout" amount="$518.00" bold />
                  </tbody>
                </table>
                <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded p-2.5 text-xs text-emerald-700">
                  <strong>Your earnings:</strong> $149 closing bonus + $20 add-on bonus = <strong>$169</strong>
                </div>
              </div>
            </div>

          </div>
        </SectionBlock>

        <SectionBlock title="Your Compensation">
          <div className="space-y-3">
            <div className="border border-border rounded-xl p-4">
              <div className="font-medium text-sm mb-1">Hourly pay — tracked via Overpass</div>
              <p className="text-sm text-muted-foreground">Your hours are monitored through Overpass. Pay is calculated from logged hours at your agreed rate.</p>
            </div>
            <div className="border border-border rounded-xl p-4">
              <div className="font-medium text-sm mb-1">Closing bonus — $149 per close</div>
              <p className="text-sm text-muted-foreground">Paid every time a new client completes checkout, regardless of plan or add-ons. 3 closes = $447 in bonuses that week.</p>
            </div>
            <div className="border border-border rounded-xl p-4">
              <div className="font-medium text-sm mb-1">Add-on bonus — first month's add-ons are yours</div>
              <p className="text-sm text-muted-foreground">Everything above the $199 base in month 1 goes to you. Full bundle close = $149 closing + $120 add-ons = <strong>$269 from one deal</strong>.</p>
            </div>
            <div className="border border-border rounded-xl p-4">
              <div className="font-medium text-sm mb-1">Custom dev commission — 10%</div>
              <p className="text-sm text-muted-foreground">Log custom project requests under Custom Dev Quotes. If it closes, you earn 10% of the project value.</p>
            </div>
          </div>
        </SectionBlock>

        <EarningsCalculator />

      </div>
    </div>
  );
}
