import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Siren, MapPin, Phone, ShieldX, History } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { reverseGeocode, timeAgo } from "@/lib/safety";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sos")({
  component: SosPage,
});

interface SosAlert {
  id: string;
  status: string;
  message: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

const EMERGENCY_NUMBERS = [
  { label: "Police", number: "112" },
  { label: "Emergency (NEMA)", number: "112" },
  { label: "Lagos Emergency", number: "767" },
];

const HOLD_MS = 2000;

function SosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sending, setSending] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const start = useRef(0);

  const { data: alerts = [] } = useQuery({
    queryKey: ["sos_alerts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("sos_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return (data ?? []) as SosAlert[];
    },
  });

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const triggerSos = async () => {
    if (!user) return;
    setSending(true);
    try {
      let lat: number | null = null;
      let lon: number | null = null;
      let address = "";
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }),
        );
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
        address = await reverseGeocode(lat, lon);
      } catch {
        // location optional
      }
      const { error } = await supabase.from("sos_alerts").insert({
        user_id: user.id,
        message: message.trim() || null,
        latitude: lat,
        longitude: lon,
        status: "active",
      });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "🚨 SOS alert sent",
        body: address
          ? `Your emergency alert was broadcast from ${address}.`
          : "Your emergency alert was broadcast.",
        type: "danger",
      });
      toast.success("SOS alert sent. Stay safe — help is being notified.");
      setMessage("");
      qc.invalidateQueries({ queryKey: ["sos_alerts"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const beginHold = () => {
    if (sending) return;
    setHolding(true);
    start.current = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(100, ((Date.now() - start.current) / HOLD_MS) * 100);
      setProgress(p);
      if (p >= 100) {
        endHold(true);
      }
    }, 30);
  };

  const endHold = (fire: boolean) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setHolding(false);
    setProgress(0);
    if (fire) triggerSos();
  };

  const cancelAlert = async (id: string) => {
    const { error } = await supabase
      .from("sos_alerts")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Alert marked as resolved");
    qc.invalidateQueries({ queryKey: ["sos_alerts"] });
  };

  return (
    <AppLayout title="Emergency SOS">
      <div className="mx-auto max-w-xl space-y-5 animate-float-up">
        <Card className="flex flex-col items-center gap-5 border-sos/30 bg-card p-6 text-center shadow-card">
          <p className="text-sm text-muted-foreground">
            Press and hold the button to broadcast an emergency alert with your
            live location.
          </p>

          <button
            onMouseDown={beginHold}
            onMouseUp={() => endHold(false)}
            onMouseLeave={() => holding && endHold(false)}
            onTouchStart={beginHold}
            onTouchEnd={() => endHold(false)}
            disabled={sending}
            className={cn(
              "relative flex h-44 w-44 items-center justify-center rounded-full bg-sos text-sos-foreground transition-transform",
              holding ? "scale-95" : "hover:scale-[1.03]",
              "shadow-[0_0_60px_-10px_hsl(var(--sos)/0.7)]",
            )}
          >
            <span
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(rgba(255,255,255,.85) ${progress}%, transparent 0)`,
                WebkitMask: "radial-gradient(transparent 64%, #000 65%)",
                mask: "radial-gradient(transparent 64%, #000 65%)",
              }}
            />
            <div className="flex flex-col items-center gap-1">
              <Siren className={cn("h-12 w-12", holding && "animate-pulse")} />
              <span className="text-sm font-bold">
                {sending ? "Sending..." : holding ? "Keep holding" : "Hold for SOS"}
              </span>
            </div>
          </button>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional: describe your emergency (e.g. trapped, being followed)"
            rows={2}
            maxLength={300}
            className="w-full"
          />
        </Card>

        <Card className="space-y-3 border-border bg-card p-5 shadow-card">
          <h3 className="flex items-center gap-2 font-display font-bold">
            <Phone className="h-4 w-4 text-primary" /> Emergency hotlines
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {EMERGENCY_NUMBERS.map((e) => (
              <a
                key={e.label}
                href={`tel:${e.number}`}
                className="rounded-lg border border-border bg-background/50 p-3 text-center transition-colors hover:border-primary/50"
              >
                <p className="font-display text-lg font-bold">{e.number}</p>
                <p className="text-[11px] text-muted-foreground">{e.label}</p>
              </a>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 border-border bg-card p-5 shadow-card">
          <h3 className="flex items-center gap-2 font-display font-bold">
            <History className="h-4 w-4 text-primary" /> Your recent alerts
          </h3>
          {alerts.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No SOS alerts yet.
            </p>
          )}
          {alerts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/50 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      a.status === "active"
                        ? "border-critical/30 bg-critical/15 text-critical"
                        : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {a.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(a.created_at)}
                  </span>
                </div>
                {a.latitude != null && (
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {a.latitude.toFixed(4)}, {a.longitude?.toFixed(4)}
                  </p>
                )}
                {a.message && (
                  <p className="mt-1 truncate text-sm">{a.message}</p>
                )}
              </div>
              {a.status === "active" && (
                <Button size="sm" variant="outline" onClick={() => cancelAlert(a.id)}>
                  <ShieldX className="h-4 w-4" /> Resolve
                </Button>
              )}
            </div>
          ))}
        </Card>
      </div>
    </AppLayout>
  );
}
