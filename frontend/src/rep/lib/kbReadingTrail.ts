const KEY = "ashford_kb_reading_trail";

export interface KbSectionVisit {
  key: string;
  title: string;
  msSpent: number;
  firstOpenedAt: string;
}

export interface KbReadingTrail {
  totalKbMs: number;
  sections: KbSectionVisit[];
  firstOpenedAt: string | null;
  lastSeenAt: string | null;
  quizOpenedAt: string | null;
}

interface StoredTrail {
  totalKbMs: number;
  sections: Record<string, KbSectionVisit>;
  firstOpenedAt: string | null;
  lastSeenAt: string | null;
  quizOpenedAt: string | null;
  current: { key: string; title: string; startedAtMs: number } | null;
}

function emptyStored(): StoredTrail {
  return {
    totalKbMs: 0,
    sections: {},
    firstOpenedAt: null,
    lastSeenAt: null,
    quizOpenedAt: null,
    current: null,
  };
}

function read(): StoredTrail {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return emptyStored();
    const parsed = JSON.parse(raw) as Partial<StoredTrail>;
    return {
      totalKbMs: parsed.totalKbMs ?? 0,
      sections: parsed.sections ?? {},
      firstOpenedAt: parsed.firstOpenedAt ?? null,
      lastSeenAt: parsed.lastSeenAt ?? null,
      quizOpenedAt: parsed.quizOpenedAt ?? null,
      current: parsed.current ?? null,
    };
  } catch {
    return emptyStored();
  }
}

function write(t: StoredTrail) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    // ignore
  }
}

// Cap a single elapsed slice so an idle/backgrounded tab can't inflate totals.
const MAX_SLICE_MS = 10 * 60 * 1000; // 10 minutes per uninterrupted slice

function closeCurrent(t: StoredTrail, nowMs: number) {
  if (!t.current) return;
  const elapsed = Math.min(
    Math.max(0, nowMs - t.current.startedAtMs),
    MAX_SLICE_MS,
  );
  if (elapsed > 0) {
    const existing = t.sections[t.current.key] ?? {
      key: t.current.key,
      title: t.current.title,
      msSpent: 0,
      firstOpenedAt: new Date(t.current.startedAtMs).toISOString(),
    };
    existing.title = t.current.title;
    existing.msSpent += elapsed;
    t.sections[t.current.key] = existing;
    t.totalKbMs += elapsed;
    t.lastSeenAt = new Date(nowMs).toISOString();
  }
  t.current = null;
}

export function recordKbView(key: string, title: string) {
  const now = Date.now();
  const t = read();
  closeCurrent(t, now);
  if (!t.firstOpenedAt) t.firstOpenedAt = new Date(now).toISOString();
  // Seed a section entry on first open even before any time accrues so we
  // remember they at least opened it.
  if (!t.sections[key]) {
    t.sections[key] = {
      key,
      title,
      msSpent: 0,
      firstOpenedAt: new Date(now).toISOString(),
    };
  } else {
    t.sections[key].title = title;
  }
  t.current = { key, title, startedAtMs: now };
  t.lastSeenAt = new Date(now).toISOString();
  write(t);
}

export function flushKbReadingTrail() {
  const t = read();
  if (!t.current) return;
  closeCurrent(t, Date.now());
  write(t);
}

export function markQuizOpened() {
  const now = Date.now();
  const t = read();
  closeCurrent(t, now);
  if (!t.quizOpenedAt) t.quizOpenedAt = new Date(now).toISOString();
  t.lastSeenAt = new Date(now).toISOString();
  write(t);
}

export function getKbReadingTrail(): KbReadingTrail {
  // Snapshot without mutating storage: include any in-flight time on `current`
  // so the value sent on submit reflects what the candidate has read so far.
  const t = read();
  const snapshot: StoredTrail = JSON.parse(JSON.stringify(t));
  closeCurrent(snapshot, Date.now());
  const sections = Object.values(snapshot.sections).sort(
    (a, b) =>
      new Date(a.firstOpenedAt).getTime() -
      new Date(b.firstOpenedAt).getTime(),
  );
  return {
    totalKbMs: snapshot.totalKbMs,
    sections,
    firstOpenedAt: snapshot.firstOpenedAt,
    lastSeenAt: snapshot.lastSeenAt,
    quizOpenedAt: snapshot.quizOpenedAt,
  };
}

export function clearKbReadingTrail() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
