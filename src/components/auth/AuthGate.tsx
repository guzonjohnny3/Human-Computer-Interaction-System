"use client";

import { useState, type ReactNode } from "react";

import { useAuth } from "@/hooks/useAuth";
import { backendUrl } from "@/lib/backend";

import { LoginForm } from "./LoginForm";
import { SignUpForm } from "./SignUpForm";

interface Props {
  children: ReactNode;
}

export function AuthGate({ children }: Props) {
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex items-center gap-3 text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
          Restoring session…
        </div>
      </div>
    );
  }

  if (session) return <>{children}</>;

  const backendConfigured = backendUrl() !== null;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-[28rem] w-[28rem] rounded-full bg-purple-600/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(20,184,166,0.08),transparent_60%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-6xl flex-col items-center justify-center gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:gap-12">
        <header className="max-w-md text-center lg:text-left">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-200">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-80" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            CSUCC · Smart Campus
          </div>
          <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl">
            Restroom Air Quality
            <br />
            <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-purple-300 bg-clip-text text-transparent">
              AI Command Center
            </span>
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            Realtime IoT sensor simulation, MLR + LSTM-based forecasts, and an
            AI-driven janitorial response system for the entire CSUCC campus.
            Sign in with your institutional credentials to access the dashboard.
          </p>
          <ul className="mt-4 grid gap-1.5 text-xs text-slate-400 lg:max-w-sm">
            <li>· 13 buildings, 26 restrooms monitored every 5 seconds</li>
            <li>· INFO / WARNING / CRITICAL alerts with AI sanitation recs</li>
            <li>· Roles: Admin (dispatch + analytics) · Staff (response)</li>
          </ul>
          {!backendConfigured && (
            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
              Backend URL is not configured at build time — the live demo will
              boot in standalone mode after login.
            </div>
          )}
        </header>

        <section className="w-full max-w-md rounded-2xl border border-cyan-500/15 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-500/5 backdrop-blur-xl sm:p-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {mode === "login" ? "Sign In" : "Create Account"}
            </h2>
            <div className="flex rounded-lg border border-slate-700/60 bg-slate-900/60 p-1 text-[11px]">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-md px-3 py-1 font-semibold uppercase tracking-wider transition ${
                  mode === "login"
                    ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-md px-3 py-1 font-semibold uppercase tracking-wider transition ${
                  mode === "signup"
                    ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          {mode === "login" ? (
            <LoginForm onShowSignUp={() => setMode("signup")} />
          ) : (
            <SignUpForm onShowLogin={() => setMode("login")} />
          )}
        </section>
      </div>
    </div>
  );
}
