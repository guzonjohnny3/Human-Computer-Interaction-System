"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef } from "react";
import L, { type CircleMarker, type Map as LeafletMap } from "leaflet";
import { BUILDINGS, CAMPUS_CENTER } from "@/lib/buildings";
import { STATUS_STYLES } from "@/lib/status";
import type { RestroomState } from "@/lib/types";

interface Props {
  states: RestroomState[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CampusMapInner({ states, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, CircleMarker>>(new Map());

  // restrict bounds to keep the user on campus
  const bounds = useMemo<[[number, number], [number, number]]>(() => {
    const lats = BUILDINGS.map((b) => b.lat);
    const lngs = BUILDINGS.map((b) => b.lng);
    const pad = 0.0025;
    return [
      [Math.min(...lats) - pad, Math.min(...lngs) - pad],
      [Math.max(...lats) + pad, Math.max(...lngs) + pad],
    ];
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: CAMPUS_CENTER,
      zoom: 18,
      minZoom: 16,
      maxZoom: 20,
      zoomControl: true,
      attributionControl: true,
      maxBounds: bounds,
      maxBoundsViscosity: 1,
    });
    mapRef.current = map;

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      },
    ).addTo(map);

    // Draw building labels as small text markers.
    for (const b of BUILDINGS) {
      L.marker([b.lat, b.lng], {
        interactive: false,
        icon: L.divIcon({
          className: "csucc-building-label",
          html: `<div class="csucc-building-pill">${b.shortName}</div>`,
          iconSize: [60, 18],
          iconAnchor: [30, 9],
        }),
      }).addTo(map);
    }

    const markers = markersRef.current;
    return () => {
      map.remove();
      mapRef.current = null;
      markers.clear();
    };
  }, [bounds]);

  // create / update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const s of states) {
      const id = s.location.id;
      const style = STATUS_STYLES[s.status];
      let marker = markersRef.current.get(id);
      if (!marker) {
        marker = L.circleMarker([s.location.lat, s.location.lng], {
          radius: 9,
          color: "#0b1220",
          weight: 2,
          fillColor: style.color,
          fillOpacity: 1,
          className: style.blink ? "csucc-marker csucc-marker-blink" : "csucc-marker",
        }).addTo(map);
        marker.on("click", () => {
          onSelect(id);
        });
        markersRef.current.set(id, marker);
      } else {
        marker.setStyle({ fillColor: style.color });
        const el = marker.getElement();
        if (el) {
          el.classList.toggle("csucc-marker-blink", style.blink);
        }
      }

      const popupHtml = buildPopup(s);
      marker.bindPopup(popupHtml, { className: "csucc-popup", maxWidth: 320 });
    }
  }, [states, onSelect]);

  // Open popup on external selection
  useEffect(() => {
    if (!selectedId) return;
    const m = markersRef.current.get(selectedId);
    const map = mapRef.current;
    if (m && map) {
      map.flyTo(m.getLatLng(), 19, { duration: 0.6 });
      m.openPopup();
    }
  }, [selectedId]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0 rounded-2xl" />
      <Legend />
    </div>
  );
}

function buildPopup(s: RestroomState): string {
  const style = STATUS_STYLES[s.status];
  const row = (k: string, v: string, unit = "") =>
    `<div class="csucc-pop-row"><span>${k}</span><span class="csucc-pop-val">${v}<span class="csucc-pop-unit">${unit}</span></span></div>`;
  return `
    <div class="csucc-pop">
      <div class="csucc-pop-head">
        <div>
          <div class="csucc-pop-building">${s.location.buildingName}</div>
          <div class="csucc-pop-type">${s.location.type} Comfort Room</div>
        </div>
        <span class="csucc-pop-badge" style="background:${style.color}33;color:${style.color};border:1px solid ${style.color}66">${style.label}</span>
      </div>
      <div class="csucc-pop-grid">
        ${row("MQ135", s.current.mq135.toFixed(1), " ppm")}
        ${row("MQ136", s.current.mq136.toFixed(1), " ppm")}
        ${row("MQ137", s.current.mq137.toFixed(1), " ppm")}
        ${row("Temperature", s.current.temperature.toFixed(1), " °C")}
        ${row("Humidity", s.current.humidity.toFixed(1), " %")}
        ${row("Odor Level", s.current.odor.toFixed(1), " /100")}
        ${row("Air Quality", s.current.airQuality.toFixed(1), " /100")}
        ${row("Status", style.label)}
      </div>
    </div>
  `;
}

function Legend() {
  const items: { label: string; color: string; sub: string; blink?: boolean }[] = [
    { label: "Safe", color: "#22c55e", sub: "Clean" },
    { label: "Moderate", color: "#eab308", sub: "Mild odor" },
    { label: "Poor", color: "#f97316", sub: "Strong odor" },
    { label: "Hazardous", color: "#ef4444", sub: "Dangerous NH3" },
    { label: "Critical", color: "#7f1d1d", sub: "Sanitize NOW", blink: true },
  ];
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-[10px] backdrop-blur-md">
      <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">Status Legend</div>
      <ul className="grid grid-cols-1 gap-0.5">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${it.blink ? "animate-pulse" : ""}`}
              style={{ background: it.color, boxShadow: `0 0 6px ${it.color}` }}
            />
            <span className="text-slate-200">{it.label}</span>
            <span className="text-slate-500">— {it.sub}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
