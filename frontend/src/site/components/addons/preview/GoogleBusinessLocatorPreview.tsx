import { MapPin, Phone, Clock, Navigation, Car } from "lucide-react";

/**
 * Click-preview drawer body for the `google_business_locator` default
 * feature. Faux Google Maps embed (SVG-style streets + a brand pin)
 * paired with a sidebar that surfaces the click-to-call number, hours,
 * and "open now" state. Mobile-friendly: stacks below the map.
 */
export const GoogleBusinessLocatorPreview = () => (
  <div className="space-y-3">
    <div className="bg-white rounded-xl border border-ink/10 overflow-hidden">
      <div className="grid sm:grid-cols-5">
        {/* Map */}
        <div className="sm:col-span-3 relative bg-sage/10 h-56 sm:h-72 overflow-hidden">
          {/* Faux streets */}
          <svg viewBox="0 0 200 160" className="absolute inset-0 w-full h-full">
            <rect width="200" height="160" fill="rgb(243 240 232)" />
            <path d="M0 60 H200" stroke="rgb(196 190 173)" strokeWidth="6" />
            <path d="M0 110 H200" stroke="rgb(196 190 173)" strokeWidth="4" />
            <path d="M70 0 V160" stroke="rgb(196 190 173)" strokeWidth="5" />
            <path d="M140 0 V160" stroke="rgb(196 190 173)" strokeWidth="3" />
            <rect x="20" y="20" width="40" height="30" fill="rgb(214 208 188)" rx="2" />
            <rect x="80" y="70" width="50" height="30" fill="rgb(214 208 188)" rx="2" />
            <rect x="150" y="120" width="40" height="30" fill="rgb(214 208 188)" rx="2" />
            <rect x="20" y="120" width="40" height="30" fill="rgb(214 208 188)" rx="2" />
            <rect x="150" y="20" width="40" height="30" fill="rgb(214 208 188)" rx="2" />
          </svg>
          {/* Pin */}
          <div className="absolute left-[44%] top-[36%]">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-ink shadow-xl flex items-center justify-center">
                <MapPin className="w-5 h-5 text-cream" />
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 top-9 w-3 h-3 rotate-45 bg-ink" />
            </div>
          </div>
          {/* Pulsing ring */}
          <div className="absolute left-[44%] top-[36%] -translate-x-3 -translate-y-3 w-16 h-16 rounded-full border-2 border-ink/20 animate-pulse" />
          {/* Map controls */}
          <div className="absolute right-3 top-3 flex flex-col gap-1">
            <button className="w-7 h-7 rounded bg-white shadow text-ink/60 text-sm font-medium">
              +
            </button>
            <button className="w-7 h-7 rounded bg-white shadow text-ink/60 text-sm font-medium">
              −
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="sm:col-span-2 p-4 space-y-3 border-t sm:border-t-0 sm:border-l border-ink/10">
          <div>
            <div className="font-display text-[15px] text-ink leading-tight mb-0.5">
              Dr. Maya Alvarado, LCSW
            </div>
            <div className="text-[12px] text-ink/65">
              318 W 6th St, Suite 204
              <br />
              Austin, TX 78701
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <a
              href="tel:5125551812"
              className="inline-flex items-center gap-2 rounded-md bg-sage text-white px-3 py-2 text-[13px] font-medium"
            >
              <Phone className="w-3.5 h-3.5" />
              (512) 555-1812
            </a>
            <button className="inline-flex items-center gap-2 rounded-md border border-ink/15 px-3 py-2 text-[13px] text-ink/85">
              <Navigation className="w-3.5 h-3.5 text-ink/55" />
              Get directions
            </button>
          </div>

          <div className="border-t border-ink/10 pt-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Clock className="w-3 h-3 text-sage" />
              <span className="text-[10px] uppercase tracking-widest text-sage font-mono">
                Open now · until 6 PM
              </span>
            </div>
            <ul className="text-[11px] text-ink/70 space-y-0.5 font-mono">
              <li className="flex justify-between">
                <span>Mon-Thu</span>
                <span>9 AM — 6 PM</span>
              </li>
              <li className="flex justify-between">
                <span>Fri</span>
                <span>9 AM — 1 PM</span>
              </li>
              <li className="flex justify-between text-ink/40">
                <span>Sat-Sun</span>
                <span>Closed</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div className="bg-cream-warm rounded-xl border border-ink/10 p-3 flex items-start gap-2">
      <Car className="w-4 h-4 text-ink/55 shrink-0 mt-0.5" />
      <div className="text-[11px] text-ink/70 leading-relaxed">
        Pulls live hours, photos, and the rating straight from your Google
        Business Profile — no copy/paste, no stale weekend hours showing on
        a holiday Monday.
      </div>
    </div>

    <div className="text-[11px] text-ink/55 italic leading-relaxed">
      Click-to-call from this map drives roughly 1 in 5 of your inbound
      calls in our pilot cohort, especially on mobile.
    </div>
  </div>
);
