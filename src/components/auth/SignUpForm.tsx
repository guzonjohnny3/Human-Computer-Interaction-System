"use client";

import { useEffect, useState } from "react";

import { useAuth, fieldErrorsOf } from "@/hooks/useAuth";
import {
  fetchSecurityQuestions,
  formatCsuccId,
  isInstitutionalEmail,
  type SecurityQuestion,
} from "@/lib/auth";

import { FloatingField } from "./FloatingField";
import {
  IconBadge,
  IconBroom,
  IconChevron,
  IconKey,
  IconLock,
  IconMail,
  IconShield,
  IconUser,
} from "./icons";

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
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    fetchSecurityQuestions()
      .then((qs) => {
        setQuestions(qs);
        if (qs.length >= 2) {
          setForm((f) => ({ ...f, security_q1: qs[0].key, security_q2: qs[1].key }));
        }
      })
      .catch(() => {
        // Backend offline → fall back to the same list the model knows.
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
    !!qDistinct &&
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
    <form onSubmit={onSubmit} className="grid gap-4" autoComplete="on" aria-busy={busy}>
      <SectionTitle index={1} title="Identity">
        Used to verify you are a CSUCC personnel member.
      </SectionTitle>

      <FloatingField
        name="csucc_id"
        label="CSUCC ID Number"
        inputMode="numeric"
        leadingIcon={<IconBadge className="h-4 w-4" />}
        value={form.csucc_id}
        onChange={(e) => set("csucc_id", formatCsuccId(e.target.value))}
        maxLength={13}
        required
        hint="Auto-formatted as xxxxxx-xxxxxx"
        error={fieldErrors.csucc_id?.[0] || (!idValid ? "Format must be xxxxxx-xxxxxx (12 digits)." : undefined)}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <FloatingField
          name="first_name"
          label="First Name"
          leadingIcon={<IconUser className="h-4 w-4" />}
          value={form.first_name}
          onChange={(e) => set("first_name", e.target.value)}
          required
          error={fieldErrors.first_name?.[0]}
        />
        <FloatingField
          name="middle_name"
          label="Middle Name (optional)"
          leadingIcon={<IconUser className="h-4 w-4" />}
          value={form.middle_name}
          onChange={(e) => set("middle_name", e.target.value)}
        />
        <FloatingField
          name="last_name"
          label="Last Name"
          leadingIcon={<IconUser className="h-4 w-4" />}
          value={form.last_name}
          onChange={(e) => set("last_name", e.target.value)}
          required
          error={fieldErrors.last_name?.[0]}
        />
      </div>

      <FloatingField
        name="email"
        type="email"
        label="Institutional Email"
        leadingIcon={<IconMail className="h-4 w-4" />}
        value={form.email}
        onChange={(e) => set("email", e.target.value)}
        pattern="[^@\s]+@csucc\.edu\.ph"
        required
        hint="Must end in @csucc.edu.ph"
        error={fieldErrors.email?.[0] || (!emailValid ? "Email must end in @csucc.edu.ph." : undefined)}
      />

      <SectionTitle index={2} title="Role">
        Admins dispatch janitors and view analytics. Staff respond to alerts.
      </SectionTitle>

      <div className="grid grid-cols-2 gap-3">
        <RolePillar
          active={form.role === "Admin"}
          onClick={() => set("role", "Admin")}
          icon={<IconShield className="h-5 w-5" />}
          title="Admin"
          subtitle="Dispatch · analytics · manage"
        />
        <RolePillar
          active={form.role === "Staff"}
          onClick={() => set("role", "Staff")}
          icon={<IconBroom className="h-5 w-5" />}
          title="Staff"
          subtitle="Receive alerts · respond"
        />
      </div>

      <SectionTitle index={3} title="Credentials">
        Choose a strong password. Security questions help recover access.
      </SectionTitle>

      <div className="grid gap-3 sm:grid-cols-2">
        <FloatingField
          name="password"
          type={showPw ? "text" : "password"}
          label="Password"
          autoComplete="new-password"
          leadingIcon={<IconLock className="h-4 w-4" />}
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          minLength={8}
          required
          hint="Minimum 8 characters"
          error={fieldErrors.password?.[0]}
          rightAdornment={
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200/70 hover:text-amber-100"
              aria-pressed={showPw}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? "Hide" : "Show"}
            </button>
          }
        />
        <FloatingField
          name="confirm_password"
          type={showPw ? "text" : "password"}
          label="Confirm Password"
          autoComplete="new-password"
          leadingIcon={<IconLock className="h-4 w-4" />}
          value={form.confirm_password}
          onChange={(e) => set("confirm_password", e.target.value)}
          minLength={8}
          required
          error={fieldErrors.confirm_password?.[0] || (!pwMatches ? "Passwords do not match." : undefined)}
        />
      </div>

      <fieldset className="grid gap-3 rounded-2xl border border-amber-200/15 bg-black/25 p-4">
        <legend className="flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-200/80">
          <IconKey className="h-3.5 w-3.5" />
          Security Questions
        </legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <FloatingSelect
            label="Question 1"
            name="security_q1"
            value={form.security_q1}
            onChange={(v) => set("security_q1", v)}
            options={questions.map((q) => ({
              ...q,
              disabled: q.key === form.security_q2,
            }))}
          />
          <FloatingField
            name="security_a1"
            label="Answer 1"
            value={form.security_a1}
            onChange={(e) => set("security_a1", e.target.value)}
            required
            error={fieldErrors.security_a1?.[0]}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FloatingSelect
            label="Question 2"
            name="security_q2"
            value={form.security_q2}
            onChange={(v) => set("security_q2", v)}
            options={questions.map((q) => ({
              ...q,
              disabled: q.key === form.security_q1,
            }))}
            error={!qDistinct ? "Pick a different question from the first." : undefined}
          />
          <FloatingField
            name="security_a2"
            label="Answer 2"
            value={form.security_a2}
            onChange={(e) => set("security_a2", e.target.value)}
            required
            error={fieldErrors.security_a2?.[0]}
          />
        </div>
      </fieldset>

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
        disabled={!canSubmit || busy}
        className="csucc-cta mt-1 flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-amber-50"
      >
        {busy ? (
          <>
            <span className="csucc-spinner" /> Creating account…
          </>
        ) : (
          <>
            Create Account <IconChevron className="h-4 w-4" />
          </>
        )}
      </button>

      <div className="mt-1 flex items-center justify-between rounded-xl border border-amber-200/10 bg-black/25 px-3 py-2 text-[11px] text-amber-200/75">
        <span>Already have an account?</span>
        <button
          type="button"
          onClick={onShowLogin}
          className="rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100 transition hover:bg-amber-300/20"
        >
          Back to Sign In
        </button>
      </div>
    </form>
  );
}

/* ─── helpers ──────────────────────────────────────────────────────── */

function SectionTitle({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-1 flex items-center gap-3">
      <span
        className="grid h-7 w-7 flex-none place-items-center rounded-full text-[10px] font-bold text-amber-50"
        style={{
          background:
            "linear-gradient(135deg, rgba(245,181,0,0.95), rgba(126,31,37,0.85))",
          boxShadow: "0 4px 14px -4px rgba(245,181,0,0.55)",
        }}
        aria-hidden
      >
        {index}
      </span>
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-amber-200">
          {title}
        </p>
        {children && (
          <p className="text-[11px] text-amber-100/55">{children}</p>
        )}
      </div>
    </div>
  );
}

function RolePillar({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "csucc-role-pillar relative rounded-2xl border px-3 py-3 text-left transition",
        active
          ? "border-amber-300/60 text-amber-50"
          : "border-amber-200/15 bg-black/25 text-amber-100/70 hover:border-amber-200/40 hover:text-amber-50",
      ].join(" ")}
    >
      <div className="relative flex items-center gap-3">
        <span
          className={[
            "grid h-9 w-9 flex-none place-items-center rounded-xl",
            active
              ? "bg-gradient-to-br from-[#f5b500] to-[#7e1f25] text-amber-50 shadow-[0_6px_20px_-6px_rgba(245,181,0,0.6)]"
              : "bg-black/40 text-amber-200/70",
          ].join(" ")}
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold tracking-wide">{title}</p>
            {active && (
              <span className="rounded-full bg-amber-300/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200">
                Selected
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-amber-100/55">{subtitle}</p>
        </div>
      </div>
    </button>
  );
}

type QuestionOption = SecurityQuestion & { disabled?: boolean };

function FloatingSelect({
  label,
  name,
  value,
  onChange,
  options,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: QuestionOption[];
  error?: string;
}) {
  const id = `s-${name}`;
  return (
    <div className="grid gap-1.5">
      <div
        className={[
          "group relative rounded-xl border bg-[rgba(20,5,8,0.55)] backdrop-blur-sm transition",
          error
            ? "border-red-400/60 focus-within:border-red-300 focus-within:ring-2 focus-within:ring-red-400/30"
            : "border-amber-200/15 focus-within:border-amber-300/60 focus-within:ring-2 focus-within:ring-amber-300/25 hover:border-amber-200/25",
        ].join(" ")}
      >
        <label
          htmlFor={id}
          className="absolute -top-2 left-3 z-10 select-none bg-[#160508] px-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/85"
        >
          {label}
        </label>
        <select
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full appearance-none bg-transparent py-3 pl-4 pr-9 text-[13px] text-amber-50 outline-none"
        >
          {options.map((o) => (
            <option key={o.key} value={o.key} disabled={o.disabled} className="bg-[#160508] text-amber-100">
              {o.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-amber-200/60"
        >
          <IconChevron className="h-4 w-4 rotate-90" />
        </span>
      </div>
      {error && (
        <span className="pl-1 text-[10.5px] font-medium text-red-300">{error}</span>
      )}
    </div>
  );
}
