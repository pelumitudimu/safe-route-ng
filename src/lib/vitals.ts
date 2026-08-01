import {
  CATEGORY_LIST,
  CATEGORY_META,
  type Incident,
  type IncidentCategory,
  type IncidentSeverity,
} from "@/lib/safety";

/**
 * National demographic reference figures for Nigeria (latest UN / World Bank
 * estimates). Used only to give reported-incident statistics real-world scale.
 */
export const NIGERIA_REFERENCE = {
  population: 232_679_478,
  crudeBirthRate: 36.6, // live births per 1,000 people per year
  crudeDeathRate: 11.6, // deaths (all causes) per 1,000 people per year
  source: "UN World Population Prospects / World Bank estimates",
};

export const ANNUAL_BIRTHS = Math.round(
  (NIGERIA_REFERENCE.population * NIGERIA_REFERENCE.crudeBirthRate) / 1000,
);

export const ANNUAL_DEATHS_ALL_CAUSES = Math.round(
  (NIGERIA_REFERENCE.population * NIGERIA_REFERENCE.crudeDeathRate) / 1000,
);

/**
 * Average fatalities per reported incident, by category. These are lethality
 * weights used to turn the community/news incident feed into an *estimated*
 * death toll — they are not an official casualty register.
 */
const LETHALITY: Record<IncidentCategory, number> = {
  kidnapping: 0.9,
  robbery: 1.1,
  assault: 0.5,
  theft: 0.05,
  accident: 1.8,
  protest: 0.6,
  fire: 1.2,
  fraud: 0.01,
  harassment: 0.02,
  other: 0.3,
};

const SEVERITY_MULTIPLIER: Record<IncidentSeverity, number> = {
  low: 0.3,
  medium: 0.8,
  high: 1.8,
  critical: 4,
};

export function estimatedDeaths(inc: Incident): number {
  const base = LETHALITY[inc.category] ?? LETHALITY.other;
  const mult = SEVERITY_MULTIPLIER[inc.severity] ?? 1;
  const verified = inc.status === "verified" ? 1.15 : inc.status === "disputed" ? 0.5 : 1;
  return base * mult * verified;
}

export interface CategoryStat {
  category: IncidentCategory;
  label: string;
  reports: number;
  deaths: number;
  ratePerMillion: number;
  share: number;
}

export function categoryStats(incidents: Incident[]): CategoryStat[] {
  const rows = CATEGORY_LIST.map((category) => {
    const list = incidents.filter((i) => i.category === category);
    const deaths = list.reduce((sum, i) => sum + estimatedDeaths(i), 0);
    return {
      category,
      label: CATEGORY_META[category].label,
      reports: list.length,
      deaths: Math.round(deaths),
      ratePerMillion: 0,
      share: 0,
    };
  }).filter((r) => r.reports > 0);

  const total = rows.reduce((s, r) => s + r.deaths, 0) || 1;
  for (const r of rows) {
    r.share = Math.round((r.deaths / total) * 1000) / 10;
    r.ratePerMillion =
      Math.round((r.deaths / (NIGERIA_REFERENCE.population / 1_000_000)) * 100) / 100;
  }
  return rows.sort((a, b) => b.deaths - a.deaths);
}

export interface MonthlyPoint {
  month: string;
  reports: number;
  deaths: number;
}

export function monthlyTrend(incidents: Incident[], months = 12): MonthlyPoint[] {
  const now = new Date();
  const buckets: MonthlyPoint[] = [];
  const index = new Map<string, MonthlyPoint>();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const point: MonthlyPoint = {
      month: d.toLocaleDateString(undefined, { month: "short" }),
      reports: 0,
      deaths: 0,
    };
    buckets.push(point);
    index.set(key, point);
  }

  for (const inc of incidents) {
    const d = new Date(inc.created_at);
    const point = index.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (!point) continue;
    point.reports += 1;
    point.deaths += estimatedDeaths(inc);
  }

  return buckets.map((b) => ({ ...b, deaths: Math.round(b.deaths) }));
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
