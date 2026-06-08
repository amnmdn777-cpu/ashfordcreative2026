import { MapPin, Star, RefreshCw, AlertTriangle, Phone } from "lucide-react";

/**
 * Click-preview drawer body for `google_profile_sync`. Shows a faux
 * Google Business Profile card overlaid with the small "in sync"
 * indicator, plus a tiny health-checks panel underneath that lists
 * the things we monitor on the doc's behalf each week.
 */
export const GoogleProfileSyncPreview = () => (
  <div className="space-y-4">
    <div className="bg-white rounded-xl border border-ink/10 overflow-hidden shadow-sm">
      <div className="aspect-[16/7] bg-gradient-to-br from-sage/15 via-cream to-gold/15 relative">
        <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 gap-px opacity-25">
          {Array.from({ length: 12 * 6 }).map((_, i) => (
            <div key={i} className="bg-ink/15" />
          ))}
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative">
            <MapPin
              className="w-9 h-9 text-sage drop-shadow-md"
              fill="currentColor"
            />
            <div className="absolute inset-0 rounded-full bg-sage/30 animate-ping" />
          </div>
        </div>
        <div className="absolute top-2 right-2 inline-flex items-center gap-1 bg-cream/90 text-sage text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded">
          <RefreshCw className="w-2.5 h-2.5" />
          Synced 2h ago
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h4 className="font-display text-lg text-ink leading-tight">
            Dr. Maya Alvarado, LCSW
          </h4>
          <div className="flex items-center gap-0.5 text-gold shrink-0">
            <Star className="w-4 h-4" fill="currentColor" />
            <span className="text-sm font-medium text-ink ml-1">4.9</span>
            <span className="text-xs text-ink/55">(38)</span>
          </div>
        </div>
        <div className="text-xs text-ink/60 mb-1">
          Therapist · 1200 E 11th St, Austin, TX 78702
        </div>
        <div className="flex items-center gap-3 text-[11px] text-ink/70">
          <span className="text-sage font-medium">Open</span>
          <span>· Closes 6 PM</span>
          <span className="inline-flex items-center gap-1 ml-auto">
            <Phone className="w-3 h-3" /> (512) 555-0198
          </span>
        </div>
      </div>
    </div>

    <div className="bg-cream-warm rounded-xl border border-ink/10 p-4">
      <div className="text-[11px] uppercase tracking-widest text-ink/55 font-mono mb-2.5">
        Weekly health checks we run for you
      </div>
      <ul className="space-y-1.5 text-sm text-ink/80">
        <li className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-sage" />
          Hours, services, photos pushed from your site
        </li>
        <li className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-sage" />
          New review notifications + draft replies for you
        </li>
        <li className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-gold shrink-0" />
          <span>Watch for duplicate listings + "temporarily closed" flags</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-sage" />
          Quarterly local-pack ranking report
        </li>
      </ul>
    </div>
  </div>
);
