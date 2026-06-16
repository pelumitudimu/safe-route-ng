import {
  Skull,
  HandCoins,
  Swords,
  Car,
  Megaphone,
  Flame,
  CreditCard,
  ShieldAlert,
  Users,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";

export type IncidentCategory =
  | "robbery"
  | "kidnapping"
  | "assault"
  | "theft"
  | "accident"
  | "protest"
  | "fire"
  | "fraud"
  | "harassment"
  | "other";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "pending" | "verified" | "disputed" | "resolved";

export const CATEGORY_META: Record<
  IncidentCategory,
  { label: string; icon: LucideIcon }
> = {
  robbery: { label: "Armed Robbery", icon: HandCoins },
  kidnapping: { label: "Kidnapping", icon: Skull },
  assault: { label: "Assault", icon: Swords },
  theft: { label: "Theft", icon: ShieldAlert },
  accident: { label: "Road Accident", icon: Car },
  protest: { label: "Protest / Unrest", icon: Megaphone },
  fire: { label: "Fire / Hazard", icon: Flame },
  fraud: { label: "Fraud / Scam", icon: CreditCard },
  harassment: { label: "Harassment", icon: Users },
  other: { label: "Other", icon: CircleHelp },
};

export const CATEGORY_LIST = Object.keys(CATEGORY_META) as IncidentCategory[];

export const SEVERITY_META: Record<
  IncidentSeverity,
  { label: string; token: "safe" | "caution" | "danger" | "critical"; weight: number }
> = {
  low: { label: "Low", token: "caution", weight: 1 },
  medium: { label: "Medium", token: "danger", weight: 2 },
  high: { label: "High", token: "danger", weight: 3.5 },
  critical: { label: "Critical", token: "critical", weight: 5 },
};

export const STATUS_META: Record<IncidentStatus, { label: string; token: string }> = {
  pending: { label: "Unverified", token: "caution" },
  verified: { label: "Verified", token: "safe" },
  disputed: { label: "Disputed", token: "danger" },
  resolved: { label: "Resolved", token: "muted" },
};

export interface Incident {
  id: string;
  reporter_id: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  title: string;
  description: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  photo_url: string | null;
  status: IncidentStatus;
  confirm_count: number;
  dispute_count: number;
  created_at: string;
  updated_at: string;
}

// Haversine distance in km
export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Recency multiplier — fresh incidents weigh more
function recencyFactor(createdAt: string): number {
  const days = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  if (days < 1) return 1;
  if (days < 3) return 0.8;
  if (days < 7) return 0.6;
  if (days < 30) return 0.35;
  return 0.15;
}

export type RiskLevel = {
  score: number; // 0-100
  label: string;
  token: "safe" | "caution" | "danger" | "critical";
  description: string;
};

export function riskFromScore(score: number): Omit<RiskLevel, "score"> {
  if (score < 20)
    return { label: "Low Risk", token: "safe", description: "Area appears generally safe" };
  if (score < 45)
    return { label: "Moderate", token: "caution", description: "Stay alert in this area" };
  if (score < 70)
    return { label: "High Risk", token: "danger", description: "Caution strongly advised" };
  return { label: "Severe", token: "critical", description: "Avoid this area if possible" };
}

// Score the safety of a point given nearby incidents
export function areaRisk(
  incidents: Incident[],
  lat: number,
  lon: number,
  radiusKm = 3,
): RiskLevel {
  let raw = 0;
  for (const inc of incidents) {
    if (inc.status === "resolved" || inc.status === "disputed") continue;
    const d = distanceKm(lat, lon, inc.latitude, inc.longitude);
    if (d > radiusKm) continue;
    const proximity = 1 - d / radiusKm; // closer = higher
    const verifyBoost = inc.status === "verified" ? 1.4 : 1;
    raw +=
      SEVERITY_META[inc.severity].weight *
      proximity *
      recencyFactor(inc.created_at) *
      verifyBoost;
  }
  // squash to 0-100
  const score = Math.min(100, Math.round((1 - Math.exp(-raw / 6)) * 100));
  return { score, ...riskFromScore(score) };
}

export interface GeoResult {
  label: string;
  lat: number;
  lon: number;
}

// Free OSM geocoding (no API key)
export async function geocode(query: string): Promise<GeoResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ng&q=${encodeURIComponent(
    query,
  )}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;
  return data.map((d) => ({
    label: d.display_name,
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
  }));
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return "";
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? "";
  } catch {
    return "";
  }
}

// Lagos default center
export const DEFAULT_CENTER: [number, number] = [6.5244, 3.3792];

export function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(date).toLocaleDateString();
}
