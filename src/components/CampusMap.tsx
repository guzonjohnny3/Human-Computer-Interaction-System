"use client";

import dynamic from "next/dynamic";
import type { RestroomState } from "@/lib/types";

const MapInner = dynamic(() => import("./CampusMapInner").then((m) => m.CampusMapInner), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-xs text-slate-500">
      Booting smart campus map…
    </div>
  ),
});

interface Props {
  states: RestroomState[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CampusMap(props: Props) {
  return <MapInner {...props} />;
}
