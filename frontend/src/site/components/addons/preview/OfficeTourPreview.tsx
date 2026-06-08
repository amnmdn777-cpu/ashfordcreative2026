import { Camera, ArrowRight } from "lucide-react";
import waitingImg from "/addon-previews/office-tour-waiting.png?url";
import doorImg from "/addon-previews/office-tour-door.png?url";
import chairImg from "/addon-previews/office-tour-chair.png?url";
import exteriorImg from "/addon-previews/office-tour-exterior.png?url";

/**
 * Click-preview drawer body for the `office_tour` default feature.
 * Renders a 4-photo grid mock of the practice's real space (door /
 * waiting room / chair / exterior) using AI-generated brand-grade
 * sample shots so the prospect sees what their tour will look like.
 * Caption strip underneath sells the conversion claim.
 */

const PhotoTile = ({
  src,
  label,
  caption,
  spans,
}: {
  src: string;
  label: string;
  caption: string;
  spans?: string;
}) => (
  <div
    className={`relative overflow-hidden rounded-xl border border-ink/10 bg-ink/5 ${spans ?? ""}`}
  >
    <img
      src={src}
      alt={caption}
      className="absolute inset-0 w-full h-full object-cover"
      loading="lazy"
    />
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/35 to-transparent p-3">
      <div className="text-[9px] uppercase tracking-widest text-cream/75 font-mono">
        {label}
      </div>
      <div className="text-[12px] text-cream leading-tight mt-0.5 font-medium">
        {caption}
      </div>
    </div>
  </div>
);

export const OfficeTourPreview = () => (
  <div className="space-y-3">
    <div className="bg-white rounded-xl border border-ink/10 overflow-hidden">
      <div className="border-b border-ink/5 px-4 py-2.5 bg-cream/50 flex items-center gap-2">
        <Camera className="w-3.5 h-3.5 text-ink/55" />
        <span className="text-[11px] uppercase tracking-widest text-ink/55 font-mono">
          Office tour · home page strip
        </span>
        <span className="ml-auto text-[10px] text-ink/40 font-mono">
          4 photos · 1.2s carousel
        </span>
      </div>

      <div className="p-4 grid grid-cols-4 grid-rows-2 gap-2 h-72">
        <PhotoTile
          src={doorImg}
          label="01 · Front door"
          caption="The yellow door, off Main St."
          spans="col-span-2 row-span-2"
        />
        <PhotoTile src={waitingImg} label="02 · Waiting" caption="Two chairs, one lamp." />
        <PhotoTile src={chairImg} label="03 · Your seat" caption="The corner of the room." />
        <PhotoTile src={exteriorImg} label="04 · Exterior" caption="Free street parking." />
        <div className="col-span-1 row-span-1 rounded-xl border border-dashed border-ink/20 flex items-center justify-center text-[10px] text-ink/45 font-mono uppercase tracking-widest">
          + add
        </div>
      </div>
    </div>

    <div className="bg-cream-warm rounded-xl border border-ink/10 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-sage/15 text-sage flex items-center justify-center shrink-0">
        <ArrowRight className="w-4 h-4" />
      </div>
      <div>
        <div className="text-[12px] font-medium text-ink leading-tight">
          Anxious first-time patients want to picture the space before they
          step in.
        </div>
        <div className="text-[11px] text-ink/65 mt-1 leading-relaxed">
          We coordinate the photo shoot (or use yours), color-grade for the
          site, and refresh once a year. Mobile-first carousel above the fold.
        </div>
      </div>
    </div>

    <div className="text-[11px] text-ink/55 italic leading-relaxed">
      Internal A/B tests: pages with an office-tour strip convert 18-24%
      better on the contact form than identical pages without one.
    </div>
  </div>
);
