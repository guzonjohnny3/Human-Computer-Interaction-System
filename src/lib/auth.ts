/**
 * Auth client for the CSUCC backend.
 *
 * The token is sent on `X-Auth-Token` (not Authorization) so it does not
 * conflict with the devinapps tunnel's Basic auth.
 */

import { backendUrl } from "./backend";

const RAW_URL = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
const STORAGE_KEY = "csucc.auth";

function basicAuth(): Record<string, string> {
  if (!RAW_URL) return {};
  try {
    const u = new URL(RAW_URL);
    if (u.username) {
      const token = `${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`;
      const encoded =
        typeof btoa === "function" ? btoa(token) : Buffer.from(token).toString("base64");
      return { Authorization: `Basic ${encoded}` };
    }
  } catch {
    /* ignore */
  }
  return {};
}

export interface AuthProfile {
  csucc_id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  full_name: string;
  email: string;
  role: "Admin" | "Staff";
  username: string;
}

export interface AuthSession {
  token: string;
  profile: AuthProfile;
}

export interface SecurityQuestion {
  key: string;
  label: string;
}

export interface RegisterPayload {
  csucc_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  role: "Admin" | "Staff";
  password: string;
  confirm_password: string;
  security_q1: string;
  security_a1: string;
  security_q2: string;
  security_a2: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export class AuthError extends Error {
  fieldErrors: Record<string, string[]>;
  constructor(message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

function api(path: string): string {
  const base = backendUrl();
  if (base === null) throw new AuthError("Backend not configured.");
  return `${base}${path}`;
}

async function callJson<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...basicAuth(),
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.token) headers["X-Auth-Token"] = init.token;
  const res = await fetch(api(path), {
    method: init.method ?? "GET",
    headers,
    body: init.body,
    cache: "no-store",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const detail =
      data && typeof data === "object" && data !== null && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : `${res.status} ${res.statusText}`;
    const fields =
      data && typeof data === "object" && data !== null && !("detail" in data)
        ? (data as Record<string, string[]>)
        : {};
    throw new AuthError(detail, fields);
  }
  return data as T;
}

export async function fetchSecurityQuestions(): Promise<SecurityQuestion[]> {
  return callJson<SecurityQuestion[]>("/api/auth/security-questions/");
}

export async function register(payload: RegisterPayload): Promise<AuthSession> {
  return callJson<AuthSession>("/api/auth/register/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function login(payload: LoginPayload): Promise<AuthSession> {
  return callJson<AuthSession>("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logout(token: string): Promise<void> {
  await callJson<{ ok: boolean }>("/api/auth/logout/", {
    method: "POST",
    body: JSON.stringify({}),
    token,
  });
}

export async function me(token: string): Promise<AuthProfile> {
  return callJson<AuthProfile>("/api/auth/me/", { token });
}

/** Storage helpers — only run on the client. */
export function loadSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (session) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

/** Auto-format CSUCC ID input as the user types (xxxxxx-xxxxxx). */
export function formatCsuccId(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

export function isInstitutionalEmail(value: string): boolean {
  return /^[^@\s]+@csucc\.edu\.ph$/i.test(value.trim());
}
