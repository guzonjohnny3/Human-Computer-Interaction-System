"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  AuthError,
  type AuthSession,
  loadSession,
  login as loginApi,
  logout as logoutApi,
  me as meApi,
  register as registerApi,
  saveSession,
  type LoginPayload,
  type RegisterPayload,
} from "@/lib/auth";

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from localStorage on mount, and refresh the profile from /me.
  // We synchronize React state with two external systems (localStorage and
  // the backend), which is the canonical case useEffect is designed for.
  useEffect(() => {
    let cancelled = false;
    const initial = loadSession();
    if (!initial) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    setSession(initial);
    meApi(initial.token)
      .then((profile) => {
        if (cancelled) return;
        const next = { ...initial, profile };
        setSession(next);
        saveSession(next);
      })
      .catch(() => {
        if (cancelled) return;
        setSession(null);
        saveSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setAndPersist = useCallback((next: AuthSession | null) => {
    setSession(next);
    saveSession(next);
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const next = await loginApi(payload);
      setAndPersist(next);
    },
    [setAndPersist],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const next = await registerApi(payload);
      setAndPersist(next);
    },
    [setAndPersist],
  );

  const logout = useCallback(async () => {
    if (session?.token) {
      try {
        await logoutApi(session.token);
      } catch {
        /* ignore: still clear locally */
      }
    }
    setAndPersist(null);
  }, [session, setAndPersist]);

  const value = useMemo(
    () => ({ session, loading, login, register, logout }),
    [session, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function fieldErrorsOf(err: unknown): Record<string, string[]> {
  return err instanceof AuthError ? err.fieldErrors : {};
}
