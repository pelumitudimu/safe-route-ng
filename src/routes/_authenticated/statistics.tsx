import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Baby, HeartPulse, Skull, TrendingUp, Info } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { LiveIndicator } from "@/components/LiveIndicator";
import { useLiveIncidents } from "@/hooks/use-live-incidents";
import {
  ANNUAL_BIRTHS,
  ANNUAL_DEATHS_ALL_CAUSES,
  NIGERIA_REFERENCE,
  categoryStats,
  estimatedDeaths,
  formatCompact,
  monthlyTrend,
} from "@/lib/vitals";

export const Route = createFileRoute("/_authenticated/statistics")({
  head: () => ({
    meta: [
      { title: "Safety Statistics — SafeRoute Nigeria" },
      {
        name: "description",
        content:
          "Estimated death rates by incident type, reporting trends and Nigeria's national birth rate, derived from live incident reports.",
      },
    ],
  }),
  component: StatisticsPage,
});

const PIE_COLORS = [
  "var(--critical)",
  "var(--danger)",
  "var(--caution)",
  "var(--chart-2)",
  "var(--safe)",
  "var(--chart-2)",
];

function StatisticsPage() {
  const { data: incidents = [] } = useLiveIncidents(500);

  const cats = useMemo(() => categoryStats(incidents), [incidents]);
  const trend = useMemo(() => monthlyTrend(incidents, 12), [incidents]);

  const totalDeaths = Math.round(incidents.reduce((s, i) => s + estimatedDeaths(i), 0));
  const deathsPerMillion =
    Math.round((totalDeaths / (NIGERIA_REFERENCE.population / 1_000_000)) * 100) / 100;
  const topCause = cats[0];

  const birthsPerDay = Math.round(ANNUAL_BIRTHS / 365);

  return (
    <AppLayout title="Vital Statistics" action={<LiveIndicator />}>
      <div className="mx-auto grid max-w-5xl gap-4">
        <p className="text-sm text-muted-foreground">
          Death figures are <span className="font-medium text-foreground">estimates</span> modelled from{" "}
          {incidents.length.toLocaleString()} reported incidents using per-category lethality and
          severity weighting. Birth and all-cause death rates are national reference figures.
        </p>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            icon={Skull}
            tone="text-critical"
            label="Est. incident deaths"
            value={totalDeaths.toLocaleString()}
            sub="from tracked reports"
          />
          <Metric
            icon={HeartPulse}
            tone="text-danger"
            label="Deaths per million"
            value={deathsPerMillion.toLocaleString()}
            sub="incident-related"
          />
          <Metric
            icon={Baby}
            tone="text-safe"
            label="Birth rate"
            value={`${NIGERIA_REFERENCE.crudeBirthRate}`}
            sub="live births per 1,000/yr"
          />
          <Metric
            icon={TrendingUp}
            tone="text-primary"
            label="Births per day"
            value={formatCompact(birthsPerDay)}
            sub="nationwide estimate"
          />
        </div>

        {/* Deaths by incident type */}
        <Card className="border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-lg font-bold">Estimated deaths by incident type</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Modelled fatalities across all tracked reports, ranked by cause.
          </p>
          <div className="mt-5 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cats} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={110}
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                />
                <Tooltip content={<ChartTip />} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="deaths" radius={[0, 6, 6, 0]} fill="var(--danger)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Trend */}
          <Card className="border-border bg-card p-5 shadow-card">
            <h2 className="font-display text-lg font-bold">12-month trend</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Reports logged vs. estimated deaths, by month.
            </p>
            <div className="mt-5 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ left: -12, right: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip content={<ChartTip />} />
                  <Line
                    type="monotone"
                    dataKey="reports"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="deaths"
                    stroke="var(--critical)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <Legend color="var(--primary)" label="Reports" />
              <Legend color="var(--critical)" label="Est. deaths" />
            </div>
          </Card>

          {/* Share of deaths */}
          <Card className="border-border bg-card p-5 shadow-card">
            <h2 className="font-display text-lg font-bold">Share of incident deaths</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Which incident types drive the most fatalities.
            </p>
            <div className="mt-5 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cats.slice(0, 6)}
                    dataKey="deaths"
                    nameKey="label"
                    innerRadius={55}
                    outerRadius={92}
                    paddingAngle={2}
                  >
                    {cats.slice(0, 6).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
              {cats.slice(0, 6).map((c, i) => (
                <Legend key={c.category} color={PIE_COLORS[i % PIE_COLORS.length]!} label={`${c.label} · ${c.share}%`} />
              ))}
            </div>
          </Card>
        </div>

        {/* Births vs deaths */}
        <Card className="border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-lg font-bold">Births vs. deaths, nationally</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Annual estimates for a population of {formatCompact(NIGERIA_REFERENCE.population)}.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Ratio label="Live births / year" value={formatCompact(ANNUAL_BIRTHS)} tone="bg-safe" />
            <Ratio
              label="Deaths / year (all causes)"
              value={formatCompact(ANNUAL_DEATHS_ALL_CAUSES)}
              tone="bg-critical"
            />
            <Ratio
              label="Natural growth / year"
              value={formatCompact(ANNUAL_BIRTHS - ANNUAL_DEATHS_ALL_CAUSES)}
              tone="bg-primary"
            />
          </div>
          <div className="mt-5 flex h-3 w-full overflow-hidden rounded-full">
            <div
              className="bg-safe"
              style={{
                width: `${(ANNUAL_BIRTHS / (ANNUAL_BIRTHS + ANNUAL_DEATHS_ALL_CAUSES)) * 100}%`,
              }}
            />
            <div className="flex-1 bg-critical" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Roughly {(ANNUAL_BIRTHS / ANNUAL_DEATHS_ALL_CAUSES).toFixed(1)} births for every death.
          </p>
        </Card>

        {/* Table */}
        <Card className="border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-lg font-bold">Breakdown by cause</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Incident type</th>
                  <th className="py-2 pr-3 text-right font-semibold">Reports</th>
                  <th className="py-2 pr-3 text-right font-semibold">Est. deaths</th>
                  <th className="py-2 pr-3 text-right font-semibold">Per million</th>
                  <th className="py-2 text-right font-semibold">Share</th>
                </tr>
              </thead>
              <tbody>
                {cats.map((c) => (
                  <tr key={c.category} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{c.label}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{c.reports}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{c.deaths}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{c.ratePerMillion}</td>
                    <td className="py-2.5 text-right tabular-nums">{c.share}%</td>
                  </tr>
                ))}
                {cats.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No incident data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {topCause && (
            <p className="mt-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{topCause.label}</span> is currently the
              leading modelled cause of incident deaths, accounting for {topCause.share}% of the total.
            </p>
          )}
        </Card>

        <p className="flex items-start gap-2 rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Methodology: each report is assigned an expected fatality value from its category and
            severity, adjusted for community verification. Population, birth and all-cause death
            rates come from {NIGERIA_REFERENCE.source}. These are indicative figures for situational
            awareness, not official mortality records.
          </span>
        </p>
      </div>
    </AppLayout>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof Skull;
  label: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <Card className="border-border bg-card p-4 shadow-card">
      <Icon className={`h-5 w-5 ${tone}`} />
      <p className="mt-3 font-display text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </Card>
  );
}

function Ratio({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <span className={`mb-2 block h-1.5 w-8 rounded-full ${tone}`} />
      <p className="font-display text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-card">
      {label != null && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-medium text-foreground tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}
