"use client";

import { useState } from "react";

import { useAuth, fieldErrorsOf } from "@/hooks/useAuth";
import { formatCsuccId } from "@/lib/auth";

interface Props {
  onShowSignUp: () => void;
}

export function LoginForm({ onShowSignUp }: Props) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onChangeIdentifier(v: string) {
    setIdentifier(/^[0-9-]*$/.test(v) ? formatCsuccId(v) : v);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login({ identifier, password });
    } catch (err) {
      const fields = fieldErrorsOf(err);
      const first = Object.values(fields).flat()[0];
      setError(first || (err instanceof Error ? err.message : "Login failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4"
      autoComplete="on"
      aria-busy={busy}
    >
      <Field
        label="CSUCC ID or Institutional Email"
        htmlFor="identifier"
        hint="Use xxxxxx-xxxxxx or your @csucc.edu.ph address"
      >
        <input
          id="identifier"
          className={inputCls}
          value={identifier}
          onChange={(e) => onChangeIdentifier(e.target.value)}
          placeholder="202300-000001 or juan.delacruz@csucc.edu.ph"
          autoComplete="username"
          required
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <input
          id="password"
          type="password"
          className={inputCls}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          minLength={8}
        />
      </Field>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !identifier || !password}
        className="mt-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/50 transition hover:from-cyan-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign In"}
      </button>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
        <span>Don&apos;t have an account?</span>
        <button
          type="button"
          onClick={onShowSignUp}
          className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-cyan-200 hover:bg-cyan-500/20"
        >
          Sign Up
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-cyan-500/30 focus:border-cyan-400/60 focus:ring-2";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="grid gap-1.5 text-xs font-medium text-slate-300">
      <span>{label}</span>
      {children}
      {hint && <span className="text-[10px] font-normal text-slate-500">{hint}</span>}
    </label>
  );
}
