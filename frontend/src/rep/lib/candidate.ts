const KEY = "ashford_candidate_session";

export interface CandidateSession {
  name: string;
  startedAt: string;
}

export function getCandidateSession(): CandidateSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CandidateSession;
    if (!parsed?.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCandidateSession(name: string) {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ name, startedAt: new Date().toISOString() }),
    );
  } catch {
    // ignore
  }
}

export function clearCandidateSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
