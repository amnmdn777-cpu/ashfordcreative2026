import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SessionUser } from "@workspace/api-zod";
import { api, ApiError } from "./api";

type AuthState = {
  user: SessionUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

// Mock auth for the unified preview: when VITE_MOCK_AUTH=true we skip the
// `/api/auth/me` call and pretend a founder/admin is signed in, so the admin
// dashboard renders without the backend running. Data fetches will still be
// empty (no API), but the full layout + navigation are viewable.
const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === "true";
const MOCK_USER: SessionUser = {
  id: 1,
  username: "admin",
  displayName: "Founder (mock)",
  role: "admin",
  promoCode: "ADMIN",
  hourlyRateCents: 0,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(
    MOCK_AUTH ? MOCK_USER : null,
  );
  const [loading, setLoading] = useState(!MOCK_AUTH);

  const refresh = async () => {
    if (MOCK_AUTH) {
      setUser(MOCK_USER);
      setLoading(false);
      return;
    }
    try {
      const r = await api.me();
      setUser(r.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = async (username: string, password: string) => {
    if (MOCK_AUTH) {
      setUser(MOCK_USER);
      return MOCK_USER;
    }
    const r = await api.login({ username, password });
    setUser(r.user);
    return r.user;
  };

  const logout = async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
