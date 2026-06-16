import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { LocateFixed, Upload, MapPin } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientOnly } from "@/components/ClientOnly";
import SafetyMap from "@/components/map/SafetyMap";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadIncidentPhoto } from "@/lib/storage";
import {
  CATEGORY_LIST,
  CATEGORY_META,
  DEFAULT_CENTER,
  reverseGeocode,
  type IncidentCategory,
  type IncidentSeverity,
} from "@/lib/safety";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/report")({
  component: ReportPage,
});

const SEVERITIES: IncidentSeverity[] = ["low", "medium", "high", "critical"];

function ReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState<IncidentCategory>("robbery");
  const [severity, setSeverity] = useState<IncidentSeverity>("high");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pos, setPos] = useState<[number, number]>(DEFAULT_CENTER);
  const [address, setAddress] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(async (p) => {
      const c: [number, number] = [p.coords.latitude, p.coords.longitude];
      setPos(c);
      setAddress(await reverseGeocode(c[0], c[1]));
    });
  }, []);

  const pickOnMap = async (lat: number, lon: number) => {
    setPos([lat, lon]);
    setAddress(await reverseGeocode(lat, lon));
  };

  const submit = async () => {
    const t = z.string().trim().min(3, "Add a short title").max(120).safeParse(title);
    if (!t.success) return toast.error(t.error.issues[0].message);
    if (!user) return;
    setLoading(true);
    try {
      let photo_url: string | null = null;
      if (file) photo_url = await uploadIncidentPhoto(file, user.id);
      const { error } = await supabase.from("incidents").insert({
        reporter_id: user.id,
        category,
        severity,
        title: t.data,
        description: description.trim() || null,
        latitude: pos[0],
        longitude: pos[1],
        address: address || null,
        photo_url,
      });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Report submitted",
        body: `Your "${t.data}" report is now live on the map.`,
        type: "success",
      });
      toast.success("Incident reported. Thank you for keeping people safe!");
      navigate({ to: "/map" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout title="Report an Incident">
      <div className="mx-auto max-w-2xl space-y-4 animate-float-up">
        <Card className="space-y-4 border-border bg-card p-5 shadow-card">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CATEGORY_LIST.map((c) => {
                const Icon = CATEGORY_META[c].icon;
                return (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      category === c
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{CATEGORY_META[c].label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as IncidentSeverity)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Robbery near Ikeja bus stop" maxLength={120} />
          </div>

          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened? Any details that could help others." maxLength={1000} rows={3} />
          </div>

          <div className="space-y-1.5">
            <Label>Photo (optional)</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground hover:bg-accent">
              <Upload className="h-4 w-4" />
              {file ? file.name : "Upload a photo"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </Card>

        <Card className="overflow-hidden border-border bg-card p-0 shadow-card">
          <div className="flex items-center justify-between gap-2 p-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-sm font-medium"><MapPin className="h-4 w-4 text-primary" /> Location</p>
              <p className="truncate text-xs text-muted-foreground">{address || `${pos[0].toFixed(4)}, ${pos[1].toFixed(4)}`}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                navigator.geolocation?.getCurrentPosition((p) => pickOnMap(p.coords.latitude, p.coords.longitude))
              }
            >
              <LocateFixed className="h-4 w-4" /> Use GPS
            </Button>
          </div>
          <div className="h-56">
            <ClientOnly fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
              <SafetyMap center={pos} zoom={14} onMapClick={pickOnMap} pickMarker={pos} className="h-full w-full" />
            </ClientOnly>
          </div>
          <p className="px-4 py-2 text-center text-xs text-muted-foreground">Tap the map to adjust the exact location</p>
        </Card>

        <Button onClick={submit} disabled={loading} size="lg" className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
          {loading ? "Submitting..." : "Submit report"}
        </Button>
      </div>
    </AppLayout>
  );
}
