import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert, Flag, TrendingUp, CheckCircle2, ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskPill } from "@/components/safety-badges";
import { LiveIndicator } from "@/components/LiveIndicator";
import { IncidentCard } from "@/components/incidents/IncidentCard";
import { useLiveIncidents } from "@/hooks/use-live-incidents";
import { useAuth } from "@/hooks/use-auth";
import { areaRisk, DEFAULT_CENTER } from "@/lib/safety";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { profile } = useAuth();
  const [loc, setLoc] = useState<[number, number]>(DEFAULT_CENTER);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setLoc([p.coords.latitude, p.coords.longitude]),
      () => {},
    );
  }, []);

  const { data: incidents = [] } = useLiveIncidents(200);


  const risk = useMemo(() => areaRisk(incidents, loc[0], loc[1], 5), [incidents, loc]);
  const last24 = incidents.filter((i) => Date.now() - new Date(i.created_at).getTime() < 86400000);
  const verified = incidents.filter((i) => i.status === "verified");

  return (
    <AppLayout title={`Hi, ${profile?.display_name?.split(" ")[0] || "there"} 👋`}>
      <div className="grid gap-4 animate-float-up">
        {/* Risk hero */}
        <Card className="border-border bg-card p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Safety near you</p>
                <LiveIndicator />
              </div>
              <h2 className="mt-1 font-display text-2xl font-bold">{risk.description}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Based on {incidents.filter((i) => i.status !== "resolved").length} active reports nearby.
              </p>
            </div>
            <RiskPill risk={risk} className="text-sm" />
          </div>
          <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-primary transition-all"
              style={{ width: `${risk.score}%` }}
            />
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat icon={ShieldAlert} label="Active reports" value={incidents.filter((i) => i.status !== "resolved").length} />
          <Stat icon={TrendingUp} label="Last 24 hours" value={last24.length} />
          <Stat icon={CheckCircle2} label="Verified" value={verified.length} />
          <Stat icon={Flag} label="Total reports" value={incidents.length} />
        </div>

        {/* Quick actions */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ActionCard to="/map" title="Open live map" desc="Heatmaps & nearby incidents" />
          <ActionCard to="/report" title="Report incident" desc="Help keep others safe" />
          <ActionCard to="/history" title="Safety history" desc="24h · 7d · 30d trends" />
          <ActionCard to="/safe-route" title="Plan a safe route" desc="Check before you travel" />
          <ActionCard to="/circle" title="Family & friends" desc="Share location & contacts" />
          <ActionCard to="/statistics" title="Statistics" desc="Death rates & vital stats" />
        </div>

        {/* Recent */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-bold">Recent incidents</h3>
            <LiveIndicator />
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/alerts">View all <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="grid gap-3">
          {incidents.slice(0, 6).map((inc) => (
            <IncidentCard key={inc.id} incident={inc} compact />
          ))}
          {incidents.length === 0 && (
            <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No incidents reported yet. Stay safe out there.
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Flag; label: string; value: number }) {
  return (
    <Card className="border-border bg-card p-4 shadow-card">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-3 font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}

function ActionCard({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/50"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold">{title}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </Link>
  );
}
