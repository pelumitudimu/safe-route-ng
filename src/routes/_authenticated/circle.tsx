import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import {
  UserPlus,
  Check,
  X,
  MapPin,
  Trash2,
  Phone,
  Plus,
  Users,
  Navigation,
  Clock,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientOnly } from "@/components/ClientOnly";
import SafetyMap, { type MapMarker } from "@/components/map/SafetyMap";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useShareLocation } from "@/hooks/use-share-location";
import { sendCircleRequest } from "@/lib/circle.functions";
import { DEFAULT_CENTER, timeAgo } from "@/lib/safety";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/circle")({
  component: CirclePage,
});

interface Connection {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
}
interface Profile {
  id: string;
  display_name: string | null;
  phone: string | null;
}
interface UserLocation {
  user_id: string;
  latitude: number | null;
  longitude: number | null;
  updated_at: string;
}
interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string | null;
  notify_on_sos: boolean;
}

const RELATIONSHIPS = ["Family", "Friend", "Partner", "Neighbour", "Colleague", "Other"];

function CirclePage() {
  const { user } = useAuth();
  const myId = user?.id;

  return (
    <AppLayout title="Family & Friends">
      <div className="mx-auto max-w-3xl animate-float-up">
        <Tabs defaultValue="circle">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="circle">
              <Users className="mr-1.5 h-4 w-4" /> Circle
            </TabsTrigger>
            <TabsTrigger value="contacts">
              <Phone className="mr-1.5 h-4 w-4" /> Emergency contacts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="circle" className="space-y-4">
            {myId && <CircleTab myId={myId} />}
          </TabsContent>

          <TabsContent value="contacts" className="space-y-4">
            {myId && <ContactsTab myId={myId} />}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

/* ------------------------------- Circle tab ------------------------------- */

function CircleTab({ myId }: { myId: string }) {
  const qc = useQueryClient();
  const requestFn = useServerFn(sendCircleRequest);
  const { sharing, updatedAt, loading: shareLoading, setSharing } = useShareLocation();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const { data: connections = [] } = useQuery({
    queryKey: ["circle", myId],
    queryFn: async () => {
      const { data } = await supabase.from("circle_connections").select("*");
      return (data ?? []) as Connection[];
    },
    refetchInterval: 30_000,
  });

  const otherId = (c: Connection) => (c.requester_id === myId ? c.addressee_id : c.requester_id);

  const incoming = connections.filter((c) => c.status === "pending" && c.addressee_id === myId);
  const outgoing = connections.filter((c) => c.status === "pending" && c.requester_id === myId);
  const accepted = connections.filter((c) => c.status === "accepted");

  const relatedIds = useMemo(
    () => Array.from(new Set(connections.map(otherId))),
    [connections], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ["circle-profiles", relatedIds],
    enabled: relatedIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, phone")
        .in("id", relatedIds);
      return (data ?? []) as Profile[];
    },
  });
  const nameOf = (id: string) =>
    profiles.find((p) => p.id === id)?.display_name || "Member";

  const acceptedIds = accepted.map(otherId);
  const { data: locations = [] } = useQuery({
    queryKey: ["circle-locations", acceptedIds],
    enabled: acceptedIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_locations")
        .select("user_id, latitude, longitude, updated_at")
        .in("user_id", acceptedIds);
      return (data ?? []) as UserLocation[];
    },
    refetchInterval: 20_000,
  });

  const located = locations.filter((l) => l.latitude != null && l.longitude != null);
  const markers: MapMarker[] = located.map((l) => ({
    lat: l.latitude as number,
    lon: l.longitude as number,
    label: nameOf(l.user_id).slice(0, 1).toUpperCase(),
    color: "#3b82f6",
  }));
  const mapCenter: [number, number] = located[0]
    ? [located[0].latitude as number, located[0].longitude as number]
    : DEFAULT_CENTER;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["circle"] });

  const sendRequest = async () => {
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) return toast.error("Enter a valid email");
    setSending(true);
    try {
      const res = await requestFn({ data: { email: parsed.data } });
      if (res.ok) {
        toast.success("Request sent");
        setEmail("");
        invalidate();
      } else if (res.reason === "not_found") {
        toast.error("No SafeRoute account found for that email");
      } else if (res.reason === "self") {
        toast.error("You can't add yourself");
      } else if (res.reason === "exists") {
        toast.error(`Already connected (${res.status})`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const respond = async (id: string, status: "accepted" | "declined") => {
    const { error } = await supabase
      .from("circle_connections")
      .update({ status })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "accepted" ? "Connection accepted" : "Request declined");
    invalidate();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("circle_connections").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  return (
    <>
      {/* Location sharing */}
      <Card className="flex items-center justify-between gap-3 border-border bg-card p-5 shadow-card">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold">
            <Navigation className="h-4 w-4 text-primary" /> Share my live location
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {sharing
              ? updatedAt
                ? `Sharing on · updated ${timeAgo(updatedAt)}`
                : "Sharing on"
              : "Only your accepted circle can see your location"}
          </p>
        </div>
        <Switch
          checked={sharing}
          disabled={shareLoading}
          onCheckedChange={async (v) => {
            await setSharing(v);
            toast.success(v ? "Location sharing on" : "Location sharing off");
          }}
        />
      </Card>

      {/* Add member */}
      <Card className="space-y-3 border-border bg-card p-5 shadow-card">
        <Label>Add family or friend by email</Label>
        <div className="flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            onKeyDown={(e) => e.key === "Enter" && sendRequest()}
          />
          <Button onClick={sendRequest} disabled={sending} className="shrink-0">
            <UserPlus className="h-4 w-4" /> {sending ? "Sending..." : "Invite"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          They need a SafeRoute account. Once they accept, you can see each other's
          location and get each other's SOS alerts.
        </p>
      </Card>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <Card className="space-y-3 border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-bold">Requests for you</h3>
          {incoming.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-medium">{nameOf(otherId(c))}</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => respond(c.id, "accepted")}>
                  <Check className="h-4 w-4" /> Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => respond(c.id, "declined")}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Map of accepted members */}
      {located.length > 0 && (
        <Card className="overflow-hidden border-border bg-card p-0 shadow-card">
          <div className="h-72">
            <ClientOnly fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
              <SafetyMap center={mapCenter} zoom={12} markers={markers} className="h-full w-full" />
            </ClientOnly>
          </div>
        </Card>
      )}

      {/* Accepted members */}
      <Card className="space-y-3 border-border bg-card p-5 shadow-card">
        <h3 className="font-display font-bold">Your circle</h3>
        {accepted.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No one in your circle yet. Invite family or friends above.
          </p>
        )}
        {accepted.map((c) => {
          const id = otherId(c);
          const loc = locations.find((l) => l.user_id === id);
          const hasLoc = loc?.latitude != null && loc?.longitude != null;
          return (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/50 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{nameOf(id)}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  {hasLoc ? (
                    <>
                      <MapPin className="h-3 w-3 text-safe" />
                      {(loc!.latitude as number).toFixed(3)}, {(loc!.longitude as number).toFixed(3)}
                      <span className="ml-1 flex items-center gap-0.5">
                        <Clock className="h-3 w-3" /> {timeAgo(loc!.updated_at)}
                      </span>
                    </>
                  ) : (
                    <>Location not shared</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {hasLoc && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${loc!.latitude}&mlon=${loc!.longitude}#map=16/${loc!.latitude}/${loc!.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button size="icon" variant="outline" className="h-8 w-8">
                      <Navigation className="h-4 w-4" />
                    </Button>
                  </a>
                )}
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </Card>

      {/* Outgoing pending */}
      {outgoing.length > 0 && (
        <Card className="space-y-3 border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-bold">Pending invites</h3>
          {outgoing.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3">
              <span className="truncate text-sm">{nameOf(otherId(c))}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Pending</Badge>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(c.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

/* ----------------------------- Contacts tab ------------------------------ */

function ContactsTab({ myId }: { myId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("Family");
  const [saving, setSaving] = useState(false);

  const { data: contacts = [] } = useQuery({
    queryKey: ["emergency-contacts", myId],
    queryFn: async () => {
      const { data } = await supabase
        .from("emergency_contacts")
        .select("id, name, phone, relationship, notify_on_sos")
        .order("created_at", { ascending: true });
      return (data ?? []) as EmergencyContact[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["emergency-contacts"] });

  const add = async () => {
    const parsed = z
      .object({
        name: z.string().trim().min(2, "Add a name").max(80),
        phone: z.string().trim().min(5, "Add a phone number").max(20),
      })
      .safeParse({ name, phone });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    try {
      const { error } = await supabase.from("emergency_contacts").insert({
        user_id: myId,
        name: parsed.data.name,
        phone: parsed.data.phone,
        relationship,
      });
      if (error) throw error;
      toast.success("Contact added");
      setName("");
      setPhone("");
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleNotify = async (id: string, value: boolean) => {
    const { error } = await supabase
      .from("emergency_contacts")
      .update({ notify_on_sos: value })
      .eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("emergency_contacts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  return (
    <>
      <Card className="space-y-3 border-border bg-card p-5 shadow-card">
        <h3 className="font-display font-bold">Add an emergency contact</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mum" maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 ..." maxLength={20} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Relationship</Label>
          <Select value={relationship} onValueChange={setRelationship}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RELATIONSHIPS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={add} disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" /> {saving ? "Adding..." : "Add contact"}
        </Button>
      </Card>

      <Card className="space-y-3 border-border bg-card p-5 shadow-card">
        <h3 className="font-display font-bold">Your contacts</h3>
        {contacts.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No emergency contacts yet.
          </p>
        )}
        {contacts.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/50 p-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{c.name}</p>
                {c.relationship && <Badge variant="outline">{c.relationship}</Badge>}
              </div>
              <a href={`tel:${c.phone}`} className="mt-0.5 flex items-center gap-1 text-xs text-primary hover:underline">
                <Phone className="h-3 w-3" /> {c.phone}
              </a>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <Switch
                  checked={c.notify_on_sos}
                  onCheckedChange={(v) => toggleNotify(c.id, v)}
                  aria-label="Notify on SOS"
                />
                <span className="mt-0.5 text-[9px] text-muted-foreground">SOS</span>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(c.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
