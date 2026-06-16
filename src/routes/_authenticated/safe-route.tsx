import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Flag, Search, ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RiskPill } from "@/components/safety-badges";
import { ClientOnly } from "@/components/ClientOnly";
import SafetyMap, { type MapMarker } from "@/components/map/SafetyMap";
import { supabase } from "@/integrations/supabase/client";
import {
  areaRisk,
  distanceKm,
  geocode,
  DEFAULT_CENTER,
  type GeoResult,
  type Incident,
} from "@/lib/safety";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/safe-route")({
  component: SafeRoutePage,
});

interface RouteResult {
  line: [number, number][];
  distanceKm: number;
  samples: { point: [number, number]; score: number }[];
  avgScore: number;
  maxScore: number;
}

function SafeRoutePage() {
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [from, setFrom] = useState<GeoResult | null>(null);
  const [to, setTo] = useState<GeoResult | null>(null);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: async () => {
      const { data } = await supabase.from("incidents").select("*").limit(500);
      return (data ?? []) as Incident[];
    },
    refetchInterval: 60000,
  });

  const resolve = async (q: string): Promise<GeoResult | null> => {
    const r = await geocode(q);
    return r[0] ?? null;
  };

  const plan = async () => {
    if (!fromText.trim() || !toText.trim()) {
      return toast.error("Enter both a start and destination");
    }
    setLoading(true);
    try {
      const [a, b] = await Promise.all([resolve(fromText), resolve(toText)]);
      if (!a || !b) {
        toast.error("Could not find one of the locations");
        return;
      }
      setFrom(a);
      setTo(b);

      // Sample points along the straight-line corridor and score each.
      const steps = 24;
      const samples: { point: [number, number]; score: number }[] = [];
      const line: [number, number][] = [];
      let total = 0;
      let max = 0;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const lat = a.lat + (b.lat - a.lat) * t;
        const lon = a.lon + (b.lon - a.lon) * t;
        line.push([lat, lon]);
        const score = areaRisk(incidents, lat, lon, 1.5).score;
        samples.push({ point: [lat, lon], score });
        total += score;
        if (score > max) max = score;
      }
      setResult({
        line,
        distanceKm: distanceKm(a.lat, a.lon, b.lat, b.lon),
        samples,
        avgScore: Math.round(total / samples.length),
        maxScore: max,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const center: [number, number] = from ? [from.lat, from.lon] : DEFAULT_CENTER;

  const markers: MapMarker[] = [];
  if (from) markers.push({ lat: from.lat, lon: from.lon, label: "A", color: "#34d399" });
  if (to) markers.push({ lat: to.lat, lon: to.lon, label: "B", color: "#ef4444" });

  return (
    <AppLayout title="Safe Route">
      <div className="mx-auto grid max-w-5xl gap-4 animate-float-up lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Card className="space-y-4 border-border bg-card p-5 shadow-card">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-safe" /> Start
              </Label>
              <Input
                value={fromText}
                onChange={(e) => setFromText(e.target.value)}
                placeholder="e.g. Ikeja, Lagos"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Flag className="h-4 w-4 text-critical" /> Destination
              </Label>
              <Input
                value={toText}
                onChange={(e) => setToText(e.target.value)}
                placeholder="e.g. Lekki Phase 1, Lagos"
              />
            </div>
            <Button
              onClick={plan}
              disabled={loading}
              className="w-full bg-gradient-primary text-primary-foreground shadow-glow"
            >
              <Search className="h-4 w-4" />
              {loading ? "Analyzing route..." : "Check safest route"}
            </Button>
            <p className="text-xs text-muted-foreground">
              We score the corridor between both points using nearby reported
              incidents. Higher scores mean greater risk along the way.
            </p>
          </Card>

          {result && (
            <Card className="space-y-4 border-border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Route safety</p>
                  <h3 className="font-display text-2xl font-bold">
                    {result.avgScore < 20
                      ? "Looks safe"
                      : result.avgScore < 45
                        ? "Stay alert"
                        : "High risk route"}
                  </h3>
                </div>
                <RiskPill risk={{ ...areaScore(result.avgScore) }} />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <Metric label="Distance" value={`${result.distanceKm.toFixed(1)} km`} />
                <Metric label="Avg risk" value={`${result.avgScore}`} />
                <Metric label="Peak risk" value={`${result.maxScore}`} />
              </div>
              <div
                className={cn(
                  "flex items-start gap-2 rounded-lg border p-3 text-sm",
                  result.maxScore >= 70
                    ? "border-critical/30 bg-critical/10 text-critical"
                    : result.maxScore >= 45
                      ? "border-danger/30 bg-danger/10 text-danger"
                      : "border-safe/30 bg-safe/10 text-safe",
                )}
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {result.maxScore >= 70
                    ? "This route passes through a severe-risk area. Consider travelling in daylight or finding an alternative."
                    : result.maxScore >= 45
                      ? "There are elevated-risk spots along this route. Stay alert and avoid stopping."
                      : "No major hotspots detected along this corridor right now."}
                </span>
              </div>
            </Card>
          )}
        </div>

        <Card className="overflow-hidden border-border bg-card p-0 shadow-card">
          <div className="h-[420px] lg:h-full lg:min-h-[520px]">
            <ClientOnly fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
              <SafetyMap
                center={center}
                zoom={12}
                incidents={incidents}
                markers={markers}
                routeLine={result?.line}
                className="h-full w-full"
              />
            </ClientOnly>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

function areaScore(score: number) {
  if (score < 20)
    return { score, label: "Low Risk", token: "safe" as const, description: "" };
  if (score < 45)
    return { score, label: "Moderate", token: "caution" as const, description: "" };
  if (score < 70)
    return { score, label: "High Risk", token: "danger" as const, description: "" };
  return { score, label: "Severe", token: "critical" as const, description: "" };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <p className="font-display text-lg font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

