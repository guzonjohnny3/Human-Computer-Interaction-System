"use client";

import { useState } from "react";

import { useAuth, fieldErrorsOf } from "@/hooks/useAuth";
import { formatCsuccId } from "@/lib/auth";

import { FloatingField } from "./FloatingField";
import { IconBadge, IconChevron, IconLock } from "./icons";

interface Props {
  onShowSignUp: () => void;
}

export function LoginForm({ onShowSignUp }: Props) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onChangeIdentifier(v: string) {
    /* When the user is typing digits/dash only we auto-format as a CSUCC
       ID; otherwise we pass the value through (so emails work too). */
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

  const canSubmit = !!identifier && !!password && !busy;

  return (
    <form onSubmit={onSubmit} className="grid gap-4" autoComplete="on" aria-busy={busy}>
      <FloatingField
        name="identifier"
        label="CSUCC ID or Institutional Email"
        autoComplete="username"
        leadingIcon={<IconBadge className="h-4 w-4" />}
        value={identifier}
        onChange={(e) => onChangeIdentifier(e.target.value)}
        hint="Use xxxxxx-xxxxxx or your @csucc.edu.ph address"
        required
      />

      <FloatingField
        name="password"
        type={showPassword ? "text" : "password"}
        label="Password"
        autoComplete="current-password"
        leadingIcon={<IconLock className="h-4 w-4" />}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
        required
        rightAdornment={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200/70 hover:text-amber-100"
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        }
      />

      <div className="flex items-center justify-between text-[11px]">
        <label className="inline-flex select-none items-center gap-2 text-amber-200/65">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-amber-400"
            defaultChecked
          />
          Keep me signed in
        </label>
        <a
          href="#"
          tabIndex={-1}
          aria-disabled
          className="text-amber-200/70 hover:text-amber-100 hover:underline"
          onClick={(e) => e.preventDefault()}
        >
          Forgot password?
        </a>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="csucc-cta mt-1 flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-amber-50"
      >
        {busy ? (
          <>
            <span className="csucc-spinner" /> Signing in…
          </>
        ) : (
          <>
            Sign In <IconChevron className="h-4 w-4" />
          </>
        )}
      </button>

      <div className="mt-1 flex items-center justify-between rounded-xl border border-amber-200/10 bg-black/25 px-3 py-2 text-[11px] text-amber-200/75">
        <span>New to the platform?</span>
        <button
          type="button"
          onClick={onShowSignUp}
          className="rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100 transition hover:bg-amber-300/20"
        >
          Create an account
        </button>
      </div>
    </form>
  );
}
