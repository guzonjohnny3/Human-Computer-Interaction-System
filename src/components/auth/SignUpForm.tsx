"use client";

import { useEffect, useState } from "react";

import { useAuth, fieldErrorsOf } from "@/hooks/useAuth";
import {
  fetchSecurityQuestions,
  formatCsuccId,
  isInstitutionalEmail,
  type SecurityQuestion,
} from "@/lib/auth";

interface Props {
  onShowLogin: () => void;
}

interface FormState {
  csucc_id: string;
  first_name: string;
  middle_name: string;
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

const EMPTY: FormState = {
  csucc_id: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  email: "",
  role: "Staff",
  password: "",
  confirm_password: "",
  security_q1: "",
  security_a1: "",
  security_q2: "",
  security_a2: "",
};

export function SignUpForm({ onShowLogin }: Props) {
  const { register } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [questions, setQuestions] = useState<SecurityQuestion[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchSecurityQuestions()
      .then((qs) => {
        setQuestions(qs);
        if (qs.length >= 2) {
          setForm((f) => ({ ...f, security_q1: qs[0].key, security_q2: qs[1].key }));
        }
      })
      .catch(() => {
        // Backend may be offline; fall back to a hardcoded list mirroring the model.
        const fallback: SecurityQuestion[] = [
          { key: "mother_maiden", label: "What is your mother's maiden name?" },
          { key: "first_pet", label: "What was the name of your first pet?" },
          { key: "elementary_school", label: "What elementary school did you attend?" },
          { key: "favorite_teacher", label: "Who was your favorite teacher?" },
          { key: "birth_city", label: "In what city were you born?" },
        ];
        setQuestions(fallback);
        setForm((f) => ({ ...f, security_q1: fallback[0].key, security_q2: fallback[1].key }));
      });
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (fieldErrors[key as string]) {
      setFieldErrors((fe) => {
        const { [key as string]: _omit, ...rest } = fe;
        void _omit;
        return rest;
      });
    }
  }

  const emailValid = !form.email || isInstitutionalEmail(form.email);
  const idValid = !form.csucc_id || /^\d{6}-\d{6}$/.test(form.csucc_id);
  const pwMatches = !form.confirm_password || form.password === form.confirm_password;
  const qDistinct = form.security_q1 && form.security_q2 && form.security_q1 !== form.security_q2;

  const canSubmit =
    !!form.csucc_id &&
    idValid &&
    !!form.first_name &&
    !!form.last_name &&
    !!form.email &&
    emailValid &&
    !!form.password &&
    form.password.length >= 8 &&
    pwMatches &&
    qDistinct &&
    !!form.security_a1 &&
    !!form.security_a2;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await register(form);
    } catch (err) {
      const fields = fieldErrorsOf(err);
      setFieldErrors(fields);
      const first = Object.values(fields).flat()[0];
      setError(first || (err instanceof Error ? err.message : "Registration failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3" autoComplete="on" aria-busy={busy}>
      <Field
        label="CSUCC ID Number"
        htmlFor="csucc_id"
        hint="Auto-formatted as xxxxxx-xxxxxx"
        error={fieldErrors.csucc_id?.[0] || (!idValid ? "Format must be xxxxxx-xxxxxx (12 digits)." : undefined)}
      >
        <input
          id="csucc_id"
          inputMode="numeric"
          className={inputCls}
          value={form.csucc_id}
          onChange={(e) => set("csucc_id", formatCsuccId(e.target.value))}
          placeholder="202300-000001"
          maxLength={13}
          required
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="First Name" htmlFor="first_name" error={fieldErrors.first_name?.[0]}>
          <input
            id="first_name"
            className={inputCls}
            value={form.first_name}
            onChange={(e) => set("first_name", e.target.value)}
            required
          />
        </Field>
        <Field label="Middle Name" htmlFor="middle_name" hint="Optional">
          <input
            id="middle_name"
            className={inputCls}
            value={form.middle_name}
            onChange={(e) => set("middle_name", e.target.value)}
          />
        </Field>
        <Field label="Last Name" htmlFor="last_name" error={fieldErrors.last_name?.[0]}>
          <input
            id="last_name"
            className={inputCls}
            value={form.last_name}
            onChange={(e) => set("last_name", e.target.value)}
            required
          />
        </Field>
      </div>

      <Field
        label="Institutional Email"
        htmlFor="email"
        hint="Must end in @csucc.edu.ph"
        error={fieldErrors.email?.[0] || (!emailValid ? "Email must end in @csucc.edu.ph." : undefined)}
      >
        <input
          id="email"
          type="email"
          className={inputCls}
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          pattern="[^@\s]+@csucc\.edu\.ph"
          placeholder="juan.delacruz@csucc.edu.ph"
          required
        />
      </Field>

      <Field label="Role" htmlFor="role">
        <select
          id="role"
          className={inputCls}
          value={form.role}
          onChange={(e) => set("role", e.target.value as "Admin" | "Staff")}
        >
          <option value="Admin">Admin</option>
          <option value="Staff">Staff</option>
        </select>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Password"
          htmlFor="password"
          hint="Minimum 8 characters"
          error={fieldErrors.password?.[0]}
        >
          <input
            id="password"
            type="password"
            className={inputCls}
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
        </Field>
        <Field
          label="Confirm Password"
          htmlFor="confirm_password"
          error={fieldErrors.confirm_password?.[0] || (!pwMatches ? "Passwords do not match." : undefined)}
        >
          <input
            id="confirm_password"
            type="password"
            className={inputCls}
            value={form.confirm_password}
            onChange={(e) => set("confirm_password", e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
        </Field>
      </div>

      <fieldset className="grid gap-3 rounded-xl border border-slate-700/60 bg-slate-900/40 p-3">
        <legend className="px-2 text-[10px] font-semibold uppercase tracking-widest text-cyan-300/80">
          Security Questions
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Question 1" htmlFor="security_q1">
            <select
              id="security_q1"
              className={inputCls}
              value={form.security_q1}
              onChange={(e) => set("security_q1", e.target.value)}
              required
            >
              {questions.map((q) => (
                <option key={q.key} value={q.key} disabled={q.key === form.security_q2}>
                  {q.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Answer 1" htmlFor="security_a1" error={fieldErrors.security_a1?.[0]}>
            <input
              id="security_a1"
              className={inputCls}
              value={form.security_a1}
              onChange={(e) => set("security_a1", e.target.value)}
              required
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Question 2"
            htmlFor="security_q2"
            error={!qDistinct ? "Pick a different question from the first." : undefined}
          >
            <select
              id="security_q2"
              className={inputCls}
              value={form.security_q2}
              onChange={(e) => set("security_q2", e.target.value)}
              required
            >
              {questions.map((q) => (
                <option key={q.key} value={q.key} disabled={q.key === form.security_q1}>
                  {q.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Answer 2" htmlFor="security_a2" error={fieldErrors.security_a2?.[0]}>
            <input
              id="security_a2"
              className={inputCls}
              value={form.security_a2}
              onChange={(e) => set("security_a2", e.target.value)}
              required
            />
          </Field>
        </div>
      </fieldset>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit || busy}
        className="mt-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/50 transition hover:from-cyan-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Creating account…" : "Create Account"}
      </button>

      <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
        <span>Already have an account?</span>
        <button
          type="button"
          onClick={onShowLogin}
          className="rounded-md border border-slate-600/60 bg-slate-800/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-200 hover:bg-slate-800/80"
        >
          Back to Login
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
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="grid gap-1.5 text-xs font-medium text-slate-300">
      <span>{label}</span>
      {children}
      {error ? (
        <span className="text-[10px] font-normal text-red-300">{error}</span>
      ) : hint ? (
        <span className="text-[10px] font-normal text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}
