import { useState, type ReactNode } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { getCandidateSession } from "@rep/lib/candidate";

const KB_SESSION_KEY = "ashford_kb_auth";
const KB_PASSWORD = "Ashford2026";

function isAuthenticated() {
  // Candidates with a name-only session bypass the rep password gate.
  if (getCandidateSession()) return true;
  try {
    return sessionStorage.getItem(KB_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function authenticate() {
  try {
    sessionStorage.setItem(KB_SESSION_KEY, "1");
  } catch {
    // sessionStorage unavailable
  }
}

export function KnowledgeBaseGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(() => isAuthenticated());
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === KB_PASSWORD) {
      authenticate();
      setAuthed(true);
      setError("");
    } else {
      setError("Incorrect password.");
      setPassword("");
    }
  };

  if (authed) return <>{children}</>;

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="bg-card border border-card-border rounded-xl p-8 w-full max-w-sm shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 grid place-items-center mx-auto mb-4 text-primary">
          <Lock size={22} />
        </div>
        <div className="font-serif text-2xl mb-1">Ashford Creative</div>
        <div className="text-xs uppercase tracking-widest text-primary mb-6">Knowledge Base</div>
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-sm font-medium mb-1.5">Access password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 pr-10 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Enter password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Access knowledge base
          </button>
        </form>
      </div>
    </div>
  );
}
