import { useState } from "react";
import { useLocation } from "wouter";
import { GraduationCap } from "lucide-react";
import { setCandidateSession, getCandidateSession } from "@rep/lib/candidate";
import { clearKbReadingTrail } from "@rep/lib/kbReadingTrail";

export default function CandidateLanding() {
  const [, navigate] = useLocation();
  const existing = getCandidateSession();
  const [name, setName] = useState(existing?.name ?? "");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Please enter your full name.");
      return;
    }
    // Starting (or restarting) a candidate session: drop any reading-trail
    // crumbs from a previous candidate so trails never bleed across people.
    if (existing?.name !== trimmed) {
      clearKbReadingTrail();
    }
    setCandidateSession(trimmed);
    navigate("/kb");
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="bg-card border border-card-border rounded-xl p-8 w-full max-w-md shadow-sm">
        <div className="w-12 h-12 rounded-full bg-primary/10 grid place-items-center mb-4 text-primary">
          <GraduationCap size={22} />
        </div>
        <div className="font-serif text-2xl mb-1">Ashford Creative</div>
        <div className="text-xs uppercase tracking-widest text-primary mb-5">
          Candidate Knowledge Base
        </div>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Welcome — thanks for your interest in joining the sales team. Take a few minutes to read through our knowledge base, then take a short 5-question quiz at the end. We'll review your answers and follow up.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Your full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="e.g. Jane Doe"
              autoFocus
            />
            {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
          </div>
          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Open the knowledge base
          </button>
        </form>
      </div>
    </div>
  );
}
