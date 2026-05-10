"use client";

import { useCallback, useMemo, useState } from "react";
import { useRestroomData } from "@/hooks/useRestroomData";
import { CampusMap } from "./CampusMap";
import { Header } from "./Header";
import { StatusCards } from "./StatusCards";
import { AIPanel } from "./AIPanel";
import { AlertFeed } from "./AlertFeed";
import { Rankings } from "./Rankings";
import { Analytics } from "./Analytics";
import { EmergencyBanner } from "./EmergencyBanner";
import { JanitorModal } from "./JanitorModal";
import { HotspotHeatmap } from "./HotspotHeatmap";
import { HistoryPanels } from "./HistoryPanels";
import type { AlertEvent, StatusLevel } from "@/lib/types";

export function Dashboard() {
  const {
    states,
    predictions,
    alerts,
    cleanings,
    lastTick,
    tickMs,
    dispatchJanitor,
    injectDemoHazard,
  } = useRestroomData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalRestroomId, setModalRestroomId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const s = { total: states.length, safe: 0, moderate: 0, poor: 0, hazardous: 0, critical: 0 };
    for (const r of states) (s as Record<StatusLevel | "total", number>)[r.status]++;
    return s;
  }, [states]);

  const selected = useMemo(
    () => states.find((s) => s.location.id === selectedId) ?? null,
    [states, selectedId],
  );

  const modalState = useMemo(
    () => states.find((s) => s.location.id === modalRestroomId) ?? null,
    [states, modalRestroomId],
  );

  const openAlert = useCallback((a: AlertEvent) => {
    setSelectedId(a.restroomId);
    setModalRestroomId(a.restroomId);
  }, []);

  const openModalFor = useCallback((id: string) => {
    setSelectedId(id);
    setModalRestroomId(id);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      {/* ambient backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(236,72,153,0.12),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <Header
        summary={summary}
        lastTick={lastTick}
        tickMs={tickMs}
        onInjectHazard={(level) => {
          const target = injectDemoHazard(level);
          if (target) setSelectedId(target.location.id);
        }}
      />
      <EmergencyBanner states={states} onSelect={openModalFor} />

      <main className="mx-auto max-w-[1600px] px-4 py-4 lg:px-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Map */}
          <section className="lg:col-span-8">
            <div className="relative h-[460px] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-md lg:h-[560px]">
              <CampusMap states={states} selectedId={selectedId} onSelect={handleSelect} />
              <div className="pointer-events-none absolute right-3 top-3 z-[400] rounded-lg bg-slate-950/70 px-2.5 py-1.5 text-[10px] backdrop-blur-md ring-1 ring-white/10">
                <span className="text-slate-400">Markers:</span>{" "}
                <span className="font-mono text-cyan-200">{states.length}</span>{" "}
                <span className="text-slate-500">restrooms</span>
              </div>
            </div>
            <div className="mt-4 hidden lg:block">
              <h3 className="mb-2 text-sm font-semibold text-white">Live Restroom Status</h3>
              <StatusCards states={states} onSelect={handleSelect} selectedId={selectedId} />
            </div>
          </section>

          {/* Right rail */}
          <aside className="space-y-4 lg:col-span-4">
            <Panel>
              <AIPanel states={states} predictions={predictions} onSelect={handleSelect} />
            </Panel>
            <Panel className="h-[340px]">
              <AlertFeed alerts={alerts} onOpenAlert={openAlert} onSelect={handleSelect} />
            </Panel>
          </aside>

          {/* mobile status cards */}
          <section className="lg:hidden">
            <h3 className="mb-2 text-sm font-semibold text-white">Live Restroom Status</h3>
            <StatusCards states={states} onSelect={handleSelect} selectedId={selectedId} />
          </section>

          {/* Heatmap + rankings row */}
          <section className="lg:col-span-5">
            <Panel>
              <HotspotHeatmap states={states} onSelect={handleSelect} />
            </Panel>
          </section>
          <section className="lg:col-span-7">
            <Panel>
              <h3 className="mb-2 text-sm font-semibold text-white">Restroom Rankings</h3>
              <Rankings states={states} onSelect={handleSelect} />
            </Panel>
          </section>

          {/* History panels + analytics */}
          <section className="lg:col-span-7">
            <Panel>
              <HistoryPanels
                alerts={alerts}
                cleanings={cleanings}
                states={states}
                onSelect={openModalFor}
              />
            </Panel>
          </section>
          <section className="lg:col-span-5">
            <Panel>
              <h3 className="mb-2 text-sm font-semibold text-white">Analytics</h3>
              <Analytics selected={selected} states={states} />
            </Panel>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 px-6 py-3 text-center text-[10px] text-slate-500">
        CSUCC Smart Restroom Air Quality Monitoring · Simulated IoT (MQ135 · MQ136 · MQ137) · MLR + LSTM-inspired forecasting
      </footer>

      {modalRestroomId && (
        <JanitorModal
          key={modalRestroomId}
          state={modalState}
          prediction={predictions.get(modalRestroomId)}
          onClose={() => setModalRestroomId(null)}
          onDispatch={dispatchJanitor}
        />
      )}
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-slate-900/40 p-4 backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}
