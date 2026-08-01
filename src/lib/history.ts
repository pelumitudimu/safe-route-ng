import {
  CATEGORY_META,
  distanceKm,
  riskFromScore,
  SEVERITY_META,
  type Incident,
  type IncidentCategory,
  type RiskLevel,
} from "@/lib/safety";

export type HistoryWindow = "24h" | "7d" | "30d";

export const WINDOW_META: Record<HistoryWindow, { label: string; hours: number; buckets: number; bucketHours: number }> = {
  "24h": { label: "Last 24 hours", hours: 24, buckets: 12, bucketHours: 2 },
  "7d": { label: "Last 7 days", hours: 24 * 7, buckets: 7, bucketHours: 24 },
  "30d": { label: "Last 30 days", hours: 24 * 30, buckets: 15, bucketHours: 48 },
};

export function withinWindow(incidents: Incident[], hours: number, offsetWindows = 0): Incident[] {
  const ms = hours * 3_600_000;
  const end = Date.now() - offsetWindows * ms;
  const start = end - ms;
  return incidents.filter((i) => {
    const t = new Date(i.created_at).getTime();
    return t > start && t <= end;
  });
}

export interface TrendPoint {
  label: string;
  reports: number;
  severe: number;
}

export function bucketTrend(incidents: Incident[], win: HistoryWindow): TrendPoint[] {
  const { buckets, bucketHours } = WINDOW_META[win];
  const size = bucketHours * 3_600_000;
  const now = Date.now();
  const points: TrendPoint[] = [];

  for (let i = buckets - 1; i >= 0; i--) {
    const end = now - i * size;
    const start = end - size;
    const list = incidents.filter((inc) => {
      const t = new Date(inc.created_at).getTime();
      return t > start && t <= end;
    });
    const d = new Date(end);
    points.push({
      label:
        win === "24h"
          ? `${String(d.getHours()).padStart(2, "0")}:00`
          : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      reports: list.length,
      severe: list.filter((x) => x.severity === "high" || x.severity === "critical").length,
    });
  }
  return points;
}

export interface WindowSummary {
  reports: number;
  severe: number;
  verified: number;
  changePct: number | null;
  topCategory: { category: IncidentCategory; label: string; count: number } | null;
}

export function summarize(incidents: Incident[], win: HistoryWindow): WindowSummary {
  const { hours } = WINDOW_META[win];
  const current = withinWindow(incidents, hours);
  const previous = withinWindow(incidents, hours, 1);

  const counts = new Map<IncidentCategory, number>();
  for (const i of current) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    reports: current.length,
    severe: current.filter((i) => i.severity === "high" || i.severity === "critical").length,
    verified: current.filter((i) => i.status === "verified").length,
    changePct:
      previous.length === 0
        ? current.length > 0
          ? 100
          : null
        : Math.round(((current.length - previous.length) / previous.length) * 100),
    topCategory: top
      ? { category: top[0], label: CATEGORY_META[top[0]].label, count: top[1] }
      : null,
  };
}

export interface Hotspot {
  key: string;
  name: string;
  lat: number;
  lon: number;
  count: number;
  severe: number;
  risk: RiskLevel;
  categories: string[];
  lastAt: string;
  /** How many of the three windows (24h / 7d / 30d) this area shows up in. */
  persistence: number;
}

const CLUSTER_RADIUS_KM = 6;

function shortName(inc: Incident): string {
  if (inc.address) {
    const parts = inc.address.split(",").map((p) => p.trim()).filter(Boolean);
    return parts.slice(0, 2).join(", ") || inc.address;
  }
  return `${inc.latitude.toFixed(2)}, ${inc.longitude.toFixed(2)}`;
}

/**
 * Groups incidents into geographic clusters so users can see which areas are
 * *consistently* risky rather than a one-off report.
 */
export function hotspots(all: Incident[], win: HistoryWindow, limit = 8): Hotspot[] {
  const { hours } = WINDOW_META[win];
  const list = withinWindow(all, hours).filter((i) => i.status !== "resolved");

  const clusters: { lat: number; lon: number; items: Incident[] }[] = [];
  for (const inc of list) {
    const found = clusters.find((c) => distanceKm(c.lat, c.lon, inc.latitude, inc.longitude) <= CLUSTER_RADIUS_KM);
    if (found) {
      found.items.push(inc);
      found.lat = found.items.reduce((s, i) => s + i.latitude, 0) / found.items.length;
      found.lon = found.items.reduce((s, i) => s + i.longitude, 0) / found.items.length;
    } else {
      clusters.push({ lat: inc.latitude, lon: inc.longitude, items: [inc] });
    }
  }

  const rows: Hotspot[] = clusters.map((c) => {
    const raw = c.items.reduce((s, i) => s + SEVERITY_META[i.severity].weight * 4, 0);
    const score = Math.min(100, Math.round(raw));
    const cats = [...new Set(c.items.map((i) => CATEGORY_META[i.category].label))].slice(0, 3);
    const sorted = [...c.items].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const persistence = (["24h", "7d", "30d"] as HistoryWindow[]).filter((w) =>
      c.items.some(
        (i) => Date.now() - new Date(i.created_at).getTime() <= WINDOW_META[w].hours * 3_600_000,
      ),
    ).length;

    return {
      key: `${c.lat.toFixed(3)}:${c.lon.toFixed(3)}`,
      name: shortName(sorted[0]!),
      lat: c.lat,
      lon: c.lon,
      count: c.items.length,
      severe: c.items.filter((i) => i.severity === "high" || i.severity === "critical").length,
      risk: { score, ...riskFromScore(score) },
      categories: cats,
      lastAt: sorted[0]!.created_at,
      persistence,
    };
  });

  return rows.sort((a, b) => b.risk.score - a.risk.score || b.count - a.count).slice(0, limit);
}

export function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
