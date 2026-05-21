"use client";

import { useState, type ReactNode } from "react";

import { useAuth } from "@/hooks/useAuth";
import { backendUrl } from "@/lib/backend";

import { CsuccCrest } from "./icons";
import { LoginForm } from "./LoginForm";
import { SignUpForm } from "./SignUpForm";

interface Props {
  children: ReactNode;
}

/**
 * AuthGate renders the CSUCC Campus Aura sign-in / sign-up surface. A
 * split layout puts the campus-branded hero on the left and the form
 * card on the right. On narrow viewports the hero compresses into a
 * compact banner above the form.
 */
export function AuthGate({ children }: Props) {
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");

  if (loading) {
    return (
      <div className="csucc-aurora-bg flex min-h-dvh items-center justify-center text-emerald-100/80">
        <div className="flex items-center gap-3 text-sm">
          <span className="csucc-spinner" />
          Restoring CSUCC session…
        </div>
      </div>
    );
  }

  if (session) return <>{children}</>;

  const backendConfigured = backendUrl() !== null;

  return (
    <div className="csucc-aurora-bg relative min-h-dvh overflow-hidden text-emerald-50">
      {/* Drifting aurora blobs */}
      <div
        className="csucc-aurora-blob"
        style={{ width: "32rem", height: "32rem", top: "-7rem", left: "-7rem", background: "rgba(34, 197, 94, 0.40)" }}
      />
      <div
        className="csucc-aurora-blob"
        style={{ width: "30rem", height: "30rem", bottom: "-9rem", right: "-7rem", background: "rgba(14, 106, 55, 0.55)", animationDelay: "-7s" }}
      />
      <div
        className="csucc-aurora-blob"
        style={{ width: "20rem", height: "20rem", top: "40%", left: "55%", background: "rgba(245, 181, 0, 0.14)", animationDelay: "-3s" }}
      />
      {/* Blueprint grid overlay */}
      <div className="pointer-events-none absolute inset-0 csucc-grid-overlay" />

      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-[1400px] grid-cols-1 gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[1.05fr_minmax(420px,_0.95fr)] lg:gap-12 lg:py-12">
        <HeroPane />

        <section className="flex w-full items-center">
          <div className="csucc-card-enter relative w-full">
            <div className="relative rounded-3xl border border-emerald-200/15 bg-[rgba(3,18,9,0.78)] p-6 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:p-8">
              {/* Emerald + subtle gold border glow */}
              <div
                className="pointer-events-none absolute inset-0 rounded-3xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(34,197,94,0.45), rgba(14,106,55,0.25) 40%, rgba(245,181,0,0.18) 80%, transparent)",
                  WebkitMask:
                    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                  padding: 1,
                }}
              />

              <div className="relative mb-6 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-emerald-200/80">
                    {mode === "login" ? "Returning Personnel" : "Personnel Enrollment"}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-emerald-50">
                    {mode === "login" ? "Welcome back." : "Create your CSUCC account"}
                  </h2>
                </div>
                <CsuccCrest className="hidden h-12 w-12 drop-shadow-[0_0_18px_rgba(34,197,94,0.45)] sm:block" />
              </div>

              <ModeSwitcher mode={mode} onChange={setMode} />

              {mode === "login" ? (
                <LoginForm onShowSignUp={() => setMode("signup")} />
              ) : (
                <SignUpForm onShowLogin={() => setMode("login")} />
              )}

              {!backendConfigured && (
                <div className="mt-5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[11px] text-emerald-200">
                  Backend URL is not configured at build time — the live demo
                  will boot in standalone simulation mode after login.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Left hero pane with branding, narrative, and feature bullets. */
function HeroPane() {
  return (
    <header className="relative flex flex-col justify-between gap-10 py-2 lg:py-6">
      <div>
        <div className="inline-flex items-center gap-3 rounded-full border border-emerald-300/30 bg-emerald-300/10 py-1.5 pl-1.5 pr-4 text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-100">
          <span className="relative grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#0e6a37] via-[#06321a] to-black">
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, rgba(34,197,94,0.55), transparent 60%)",
              }}
            />
            <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-300" />
          </span>
          CSUCC · Smart Campus Aura
        </div>

        <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-emerald-50 sm:text-5xl lg:text-[3.4rem]">
          Restroom Air Quality
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(115deg, #22c55e 0%, #86efac 35%, #ffffff 55%, #f5b500 90%)",
            }}
          >
            AI Command Center
          </span>
        </h1>

        <p className="mt-4 max-w-xl text-sm leading-relaxed text-emerald-100/70 sm:text-[15px]">
          Realtime virtual IoT sensor simulation, MLR + LSTM forecasts, and an
          AI-driven janitorial response system for the entire{" "}
          <span className="font-semibold text-emerald-200">
            Caraga State University&nbsp;— Cabadbaran City
          </span>{" "}
          campus. Sign in with your institutional credentials to access the
          dashboard.
        </p>

        <ul className="mt-6 grid max-w-xl gap-3 text-sm text-emerald-100/75">
          {[
            {
              label: "13 buildings · 26 restrooms",
              detail: "MQ135 / MQ136 / MQ137 ticking every 5 seconds",
            },
            {
              label: "AI predictions",
              detail: "Peak smell hour · worst day · 1-h hazardous window",
            },
            {
              label: "Smart janitor dispatch",
              detail: "8 tools · 4 PPE items · ammonia / sulfur / VOC playbooks",
            },
          ].map((item) => (
            <li key={item.label} className="flex items-start gap-3">
              <span
                className="mt-1 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border border-emerald-300/40 text-[10px] font-bold text-emerald-200"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(34,197,94,0.30), rgba(14,106,55,0.45))",
                }}
                aria-hidden
              >
                ✓
              </span>
              <span>
                <span className="font-semibold text-emerald-200">
                  {item.label}
                </span>
                <span className="ml-2 text-emerald-100/55">{item.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="hidden flex-col gap-2 text-[11px] uppercase tracking-[0.32em] text-emerald-200/55 lg:flex">
        <div className="flex items-center gap-2">
          <span className="h-px flex-1 bg-gradient-to-r from-emerald-300/40 to-transparent" />
          <span>capstone defence ready</span>
          <span className="h-px flex-1 bg-gradient-to-l from-emerald-300/40 to-transparent" />
        </div>
        <p className="text-center text-[10px] tracking-[0.18em] text-emerald-200/35">
          © CSUCC · College of Engineering, Information &amp; Computing Sciences
        </p>
      </div>
    </header>
  );
}

function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: "login" | "signup";
  onChange: (mode: "login" | "signup") => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Authentication mode"
      className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-emerald-200/15 bg-black/30 p-1 text-[11px]"
    >
      {(["login", "signup"] as const).map((option) => {
        const active = mode === option;
        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option)}
            className={[
              "relative rounded-xl px-4 py-2 font-semibold uppercase tracking-[0.18em] transition",
              active
                ? "text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "text-emerald-200/55 hover:text-emerald-100",
            ].join(" ")}
            style={
              active
                ? {
                    background:
                      "linear-gradient(135deg, rgba(14,106,55,0.90), rgba(6,50,26,0.90))",
                    boxShadow:
                      "0 1px 0 rgba(34,197,94,0.30) inset, 0 -1px 0 rgba(245,181,0,0.15) inset, 0 8px 24px -10px rgba(14,106,55,0.7)",
                  }
                : undefined
            }
          >
            {option === "login" ? "Sign In" : "Sign Up"}
          </button>
        );
      })}
    </div>
  );
}
