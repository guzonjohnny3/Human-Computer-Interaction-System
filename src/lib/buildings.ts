import type { Building, RestroomLocation } from "./types";

// CSUCC — Caraga State University, Cabadbaran City campus.
// Approximate campus center coordinates; layout is plausible but illustrative.
export const CAMPUS_CENTER: [number, number] = [9.11765, 125.53435];

export const BUILDINGS: Building[] = [
  { id: "mis", name: "MIS Building", shortName: "MIS", lat: 9.11820, lng: 125.53330 },
  { id: "ceit", name: "CEIT Building", shortName: "CEIT", lat: 9.11790, lng: 125.53410 },
  { id: "registrar", name: "Registrar", shortName: "REG", lat: 9.11760, lng: 125.53310 },
  { id: "cba", name: "CBA Building", shortName: "CBA", lat: 9.11730, lng: 125.53400 },
  { id: "acad", name: "ACAD Building", shortName: "ACAD", lat: 9.11770, lng: 125.53480 },
  { id: "citte", name: "CITTE Building", shortName: "CITTE", lat: 9.11700, lng: 125.53350 },
  { id: "cthm", name: "CTHM Building", shortName: "CTHM", lat: 9.11825, lng: 125.53510 },
  { id: "gym", name: "Gymnasium", shortName: "GYM", lat: 9.11680, lng: 125.53520 },
  { id: "complab", name: "Computer Laboratory", shortName: "CLAB", lat: 9.11810, lng: 125.53265 },
  { id: "library", name: "Library", shortName: "LIB", lat: 9.11750, lng: 125.53445 },
  { id: "clinic", name: "Clinic", shortName: "CLN", lat: 9.11695, lng: 125.53430 },
  { id: "osas", name: "OSAS", shortName: "OSAS", lat: 9.11740, lng: 125.53250 },
  { id: "oasfa", name: "OASFA", shortName: "OASFA", lat: 9.11665, lng: 125.53280 },
];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

export const RESTROOMS: RestroomLocation[] = BUILDINGS.flatMap((b) => {
  return (["Male", "Female"] as const).map((type) => {
    const offsetLat = type === "Male" ? 0.00012 : -0.00012;
    const offsetLng = type === "Male" ? -0.00012 : 0.00012;
    const id = `${b.id}-${type.toLowerCase()}`;
    return {
      id,
      buildingId: b.id,
      buildingName: b.name,
      type,
      lat: b.lat + offsetLat,
      lng: b.lng + offsetLng,
      baseline: hashString(id),
    } satisfies RestroomLocation;
  });
});
