import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Flame, Layers, LocateFixed } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { LiveIndicator } from "@/components/LiveIndicator";
import { ClientOnly } from "@/components/ClientOnly";
import SafetyMap from "@/components/map/SafetyMap";
import { useLiveIncidents } from "@/hooks/use-live-incidents";
import { CATEGORY_LIST, CATEGORY_META, DEFAULT_CENTER, type IncidentCategory } from "@/lib/safety";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/map")({
  component: MapPage,
});

function MapPage() {
  const [heatmap, setHeatmap] = useState(false);
  const [filter, setFilter] = useState<IncidentCategory | "all">("all");
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((p) => {
      const c: [number, number] = [p.coords.latitude, p.coords.longitude];
      setUserLoc(c);
      setCenter(c);
    });
  }, []);

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: async () => {
      const { data } = await supabase.from("incidents").select("*").limit(500);
      return (data ?? []) as Incident[];
    },
    refetchInterval: 30000,
  });

  const filtered = filter === "all" ? incidents : incidents.filter((i) => i.category === filter);

  return (
    <AppLayout
      title="Live Safety Map"
      fullBleed
      action={
        <Button
          size="sm"
          variant={heatmap ? "default" : "outline"}
          onClick={() => setHeatmap((v) => !v)}
          className={cn("gap-1.5", heatmap && "bg-gradient-primary text-primary-foreground")}
        >
          {heatmap ? <Flame className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
          {heatmap ? "Heatmap" : "Pins"}
        </Button>
      }
    >
      <div className="relative h-[calc(100vh-9rem)] md:h-[calc(100vh-4rem)]">
        <ClientOnly fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
          <SafetyMap
            incidents={filtered}
            center={center}
            heatmap={heatmap}
            userLocation={userLoc}
            className="h-full w-full"
          />
        </ClientOnly>

        {/* Filter chips */}
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex gap-2 overflow-x-auto px-3 [scrollbar-width:none]">
          <Chip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
          {CATEGORY_LIST.map((c) => (
            <Chip key={c} active={filter === c} onClick={() => setFilter(c)} label={CATEGORY_META[c].label} />
          ))}
        </div>

        {userLoc && (
          <Button
            size="icon"
            onClick={() => setCenter([userLoc[0] + Math.random() * 0.00001, userLoc[1]])}
            className="absolute bottom-4 right-4 z-[500] h-11 w-11 rounded-full bg-card text-foreground shadow-glow hover:bg-card/90"
          >
            <LocateFixed className="h-5 w-5" />
          </Button>
        )}
      </div>
    </AppLayout>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "pointer-events-auto shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background/80 text-foreground hover:bg-accent",
      )}
    >
      {label}
    </button>
  );
}
