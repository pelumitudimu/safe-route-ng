import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, History, MapPin, ShieldAlert, Repeat } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LiveIndicator } from "@/components/LiveIndicator";
import { RiskPill } from "@/components/safety-badges";
import { useLiveIncidents } from "@/hooks/use-live-incidents";
import {
  bucketTrend,
  hotspots,
  summarize,
  timeAgo,
  WINDOW_META,
  withinWindow,
  type HistoryWindow,
} from "@/lib/history";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Safety History — SafeRoute Nigeria" },
      {
        name: "description",
        content:
          "Track Nigerian safety trends over the last 24 hours, 7 days and 30 days, and see which areas stay consistently risky.",
      },
      { property: "og:title", content: "Safety History — SafeRoute Nigeria" },
      {
        property: "og:description",
        content: "24-hour, 7-day and 30-day incident trends plus recurring risk areas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

const WINDOWS: HistoryWindow[] = ["24h", "7d", "30d"];

function HistoryPage() {
  const { data: incidents = [] } = useLiveIncidents(500);
  const [win, setWin] = useState<HistoryWindow>("24h");

  const trend = useMemo(() => bucketTrend(incidents, win), [incidents, win]);
  const summary = useMemo(() => summarize(incidents, win), [incidents, win]);
  const areas = useMemo(() => hotspots(incidents, win), [incidents, win]);
  const recurring = areas.filter((a) => a.persistence >= 2);

  return (
    <AppLayout title="Safety History" action={<LiveIndicator />}>
      <div className="mx-auto grid max-w-5xl gap-4 animate-float-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Trends from {incidents.length.toLocaleString()} tracked reports — spot the areas that stay
            dangerous, not just today's noise.
          </p>
          <div className="flex rounded-lg border border-border bg-card p-1">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setWin(w)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  win === w
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {WINDOW_META[w].label.replace("Last ", "")}
              </button>
            ))}
          </div>
        </div>

        {/* Window summary */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            icon={History}
            label={WINDOW_META[win].label}
            value={summary.reports.toLocaleString()}
            sub="reports logged"
          />
          <Metric
            icon={ShieldAlert}
            tone="text-critical"
            label="High / critical"
            value={summary.severe.toLocaleString()}
            sub="severe incidents"
          />
          <Metric
            icon={summary.changePct != null && summary.changePct < 0 ? ArrowDownRight : ArrowUpRight}
            tone={
              summary.changePct != null && summary.changePct < 0 ? "text-safe" : "text-danger"
            }
            label="Vs. previous period"
            value={summary.changePct == null ? "—" : `${summary.changePct > 0 ? "+" : ""}${summary.changePct}%`}
            sub="change in reports"
          />
          <Metric
            icon={MapPin}
            tone="text-primary"
            label="Top driver"
            value={summary.topCategory?.label ?? "—"}
            sub={summary.topCategory ? `${summary.topCategory.count} reports` : "no reports yet"}
          />
        </div>

        {/* Trend chart */}
        <Card className="border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">{WINDOW_META[win].label}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Reports over time, with high/critical severity highlighted.
              </p>
            </div>
          </div>
          <div className="mt-5 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -18, right: 8 }}>
                <defs>
                  <linearGradient id="rep" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={10} interval="preserveStartEnd" />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Area
                  type="monotone"
                  dataKey="reports"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#rep)"
                  name="Reports"
                />
                <Area
                  type="monotone"
                  dataKey="severe"
                  stroke="var(--critical)"
                  strokeWidth={2}
                  fill="transparent"
                  name="High / critical"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Period comparison */}
        <div className="grid gap-3 sm:grid-cols-3">
          {WINDOWS.map((w) => {
            const s = summarize(incidents, w);
            return (
              <button
                key={w}
                onClick={() => setWin(w)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  win === w ? "border-primary/60 bg-primary/5" : "border-border bg-card hover:border-primary/40",
                )}
              >
                <p className="text-xs font-medium text-muted-foreground">{WINDOW_META[w].label}</p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums">{s.reports}</p>
                <p className="text-[11px] text-muted-foreground">
                  {s.severe} severe · {s.verified} verified
                </p>
              </button>
            );
          })}
        </div>

        {/* Risky areas */}
        <Card className="border-border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold">Areas to avoid</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Clustered within ~6&nbsp;km. Ranked by severity-weighted risk over the {WINDOW_META[win].label.toLowerCase()}.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/map">Open map</Link>
            </Button>
          </div>

          <div className="mt-4 grid gap-2.5">
            {areas.map((a) => (
              <div
                key={a.key}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{a.name}</p>
                    {a.persistence >= 2 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger">
                        <Repeat className="h-3 w-3" /> Recurring
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {a.count} reports · {a.severe} severe · last {timeAgo(a.lastAt)}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {a.categories.join(" · ")}
                  </p>
                </div>
                <RiskPill risk={a.risk} />
              </div>
            ))}
            {areas.length === 0 && (
              <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                No incidents in this period. Try a longer window.
              </p>
            )}
          </div>

          {recurring.length > 0 && (
            <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{recurring.length}</span> area
              {recurring.length > 1 ? "s have" : " has"} produced incidents across multiple time
              windows — treat these as consistently risky and plan routes around them.
            </p>
          )}
        </Card>

        {/* Latest in window */}
        <Card className="border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-lg font-bold">Most recent in this period</h2>
          <div className="mt-3 grid gap-2">
            {withinWindow(incidents, WINDOW_META[win].hours)
              .slice(0, 6)
              .map((i) => (
                <div key={i.id} className="flex items-center gap-3 border-b border-border/60 pb-2 last:border-0">
                  <span className="truncate text-sm">{i.title}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {timeAgo(i.created_at)}
                  </span>
                </div>
              ))}
            {withinWindow(incidents, WINDOW_META[win].hours).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing reported yet.</p>
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
  tone = "text-primary",
}: {
  icon: typeof History;
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <Card className="border-border bg-card p-4 shadow-card">
      <Icon className={`h-5 w-5 ${tone}`} />
      <p className="mt-3 truncate font-display text-xl font-bold tabular-nums">{value}</p>
      <p className="truncate text-xs font-medium">{label}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p>
    </Card>
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
