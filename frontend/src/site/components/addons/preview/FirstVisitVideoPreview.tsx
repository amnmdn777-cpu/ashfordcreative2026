import { Play, Volume2, Captions } from "lucide-react";
import posterImg from "/addon-previews/first-visit-poster.png?url";

/**
 * Click-preview drawer body for `first_visit_video`. Renders a faux
 * video player frame above a transcript snippet so the prospect can
 * picture the deliverable: a calm 60-second clip, captioned, branded,
 * sitting above the fold. Poster frame is an AI-generated sample shot
 * of a kind 40s therapist in a softly-lit office so the prospect sees
 * the production quality immediately.
 */
export const FirstVisitVideoPreview = () => (
  <div className="space-y-4">
    <div className="relative aspect-video rounded-xl overflow-hidden bg-ink/10 border border-ink/10">
      <img
        src={posterImg}
        alt="Dr. Maya Alvarado welcome video poster"
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-ink/30" />

      <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[10px] uppercase tracking-widest font-mono text-cream/85">
        <span>Dr. Maya Alvarado · Welcome</span>
        <span className="bg-ink/80 text-cream px-2 py-0.5 rounded">0:58</span>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <button
          type="button"
          className="w-16 h-16 rounded-full bg-cream/95 text-ink shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
        >
          <Play className="w-7 h-7 ml-1" fill="currentColor" />
        </button>
      </div>

      <div className="absolute bottom-3 inset-x-3">
        <div className="flex items-center gap-3 text-cream/90 text-xs">
          <Volume2 className="w-3.5 h-3.5" />
          <div className="flex-1 h-1 rounded-full bg-cream/30 overflow-hidden">
            <div className="h-full w-2/5 bg-cream/90 rounded-full" />
          </div>
          <Captions className="w-3.5 h-3.5" />
        </div>
        <div className="mt-2 inline-block bg-ink/85 text-cream text-[11px] px-2.5 py-1 rounded leading-snug max-w-[80%]">
          "Welcome — when you walk in, the door is on your left, and Mara
          will offer you tea."
        </div>
      </div>
    </div>

    <div className="bg-cream-warm rounded-xl border border-ink/10 p-4">
      <div className="text-[11px] uppercase tracking-widest text-ink/55 font-mono mb-2">
        What we shoot
      </div>
      <ul className="space-y-1.5 text-sm text-ink/85">
        <li>• 60-second talking-head intro to you</li>
        <li>• Walkthrough: door → waiting room → your chair</li>
        <li>• "What happens in the first session" voice-over</li>
        <li>• EN + ES captions baked in for accessibility</li>
      </ul>
    </div>
  </div>
);
