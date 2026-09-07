import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Phone, Search, ShieldAlert, Hospital, Flame, Siren, LocateFixed } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CITY_CONTACTS,
  NATIONAL_CONTACTS,
  nearestCity,
  type ContactEntry,
} from "@/lib/emergency-contacts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/emergency")({
  head: () => ({
    meta: [
      { title: "Emergency Numbers by City — SafeRoute Nigeria" },
      {
        name: "description",
        content:
          "Police, ambulance, fire and hospital emergency phone numbers for Lagos, Abuja, Port Harcourt, Kano and other Nigerian cities.",
      },
      { property: "og:title", content: "Emergency Numbers by City — SafeRoute Nigeria" },
      {
        property: "og:description",
        content: "Find verified police, emergency and hospital contacts for your Nigerian city.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmergencyPage,
});

const TYPE_META = {
  police: { label: "Police", icon: ShieldAlert, tone: "text-primary" },
  emergency: { label: "Emergency", icon: Siren, tone: "text-destructive" },
  hospital: { label: "Hospital", icon: Hospital, tone: "text-emerald-500" },
  fire: { label: "Fire", icon: Flame, tone: "text-orange-500" },
  other: { label: "Other", icon: Phone, tone: "text-muted-foreground" },
} as const;

function ContactRow({ c }: { c: ContactEntry }) {
  const meta = TYPE_META[c.type];
  const Icon = meta.icon;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background/40 p-3">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.tone)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{c.name}</p>
        {c.note && <p className="mt-0.5 text-xs text-muted-foreground">{c.note}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          {c.phones.map((p) => (
            <a key={p} href={`tel:${p.replace(/\s+/g, "")}`}>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                <Phone className="h-3.5 w-3.5" />
                {p}
              </Button>
            </a>
          ))}
        </div>
      </div>
      <Badge variant="secondary" className="shrink-0 text-[10px]">
        {meta.label}
      </Badge>
    </div>
  );
}

function EmergencyPage() {
  const [cityName, setCityName] = useState<string>(CITY_CONTACTS[0].city);
  const [q, setQ] = useState("");

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((p) => {
      setCityName(nearestCity(p.coords.latitude, p.coords.longitude).city);
    });
  }, []);

  const city = CITY_CONTACTS.find((c) => c.city === cityName) ?? CITY_CONTACTS[0];

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return city.contacts;
    return city.contacts.filter(
      (c) => c.name.toLowerCase().includes(term) || c.phones.some((p) => p.includes(term)),
    );
  }, [q, city]);

  return (
    <AppLayout
      title="Emergency Contacts"
      action={
        <a href="tel:112">
          <Button size="sm" className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90">
            <Phone className="h-4 w-4" /> Call 112
          </Button>
        </a>
      }
    >
      <div className="mx-auto max-w-3xl space-y-5 p-4">
        <Card className="border-border bg-card p-4 shadow-card">
          <h2 className="text-sm font-semibold">Works anywhere in Nigeria</h2>
          <div className="mt-3 space-y-2">
            {NATIONAL_CONTACTS.map((c) => (
              <ContactRow key={c.name} c={c} />
            ))}
          </div>
        </Card>

        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Choose your city</h2>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-xs"
              onClick={() =>
                navigator.geolocation?.getCurrentPosition((p) =>
                  setCityName(nearestCity(p.coords.latitude, p.coords.longitude).city),
                )
              }
            >
              <LocateFixed className="h-4 w-4" /> Use my location
            </Button>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {CITY_CONTACTS.map((c) => (
              <button
                key={c.city}
                onClick={() => setCityName(c.city)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  c.city === cityName
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent",
                )}
              >
                {c.city}
              </button>
            ))}
          </div>
        </div>

        <Card className="border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">
              {city.city}, {city.state}
            </h2>
            <div className="relative w-40">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search"
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {filtered.map((c) => (
              <ContactRow key={c.name} c={c} />
            ))}
            {!filtered.length && (
              <p className="py-6 text-center text-sm text-muted-foreground">No contact matches that search.</p>
            )}
          </div>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Numbers are published emergency lines and can change. If one does not connect, dial 112.
        </p>
      </div>
    </AppLayout>
  );
}
