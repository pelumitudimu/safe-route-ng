import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IncidentCard } from "@/components/incidents/IncidentCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo, type Incident } from "@/lib/safety";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/alerts")({
  component: AlertsPage,
});

function AlertsPage() {
  const { user } = useAuth();
  const [votes, setVotes] = useState<Record<string, "confirm" | "dispute">>({});
  const [notifs, setNotifs] = useState<{ id: string; title: string; body: string | null; created_at: string }[]>([]);

  const { data: incidents = [], refetch } = useQuery({
    queryKey: ["incidents"],
    queryFn: async () => {
      const { data } = await supabase.from("incidents").select("*").order("created_at", { ascending: false }).limit(200);
      return (data ?? []) as Incident[];
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("incident_verifications")
      .select("incident_id, vote")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const m: Record<string, "confirm" | "dispute"> = {};
        (data ?? []).forEach((v) => (m[v.incident_id] = v.vote as "confirm" | "dispute"));
        setVotes(m);
      });
    supabase
      .from("notifications")
      .select("id, title, body, created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setNotifs(data ?? []));
  }, [user?.id]);

  const vote = async (incident: Incident, v: "confirm" | "dispute") => {
    if (!user) return;
    const current = votes[incident.id];
    if (current === v) {
      await supabase.from("incident_verifications").delete().eq("incident_id", incident.id).eq("user_id", user.id);
      setVotes((p) => { const n = { ...p }; delete n[incident.id]; return n; });
    } else {
      await supabase
        .from("incident_verifications")
        .upsert({ incident_id: incident.id, user_id: user.id, vote: v }, { onConflict: "incident_id,user_id" });
      setVotes((p) => ({ ...p, [incident.id]: v }));
    }
    toast.success("Thanks — your input helps verify reports.");
    refetch();
  };

  const danger = incidents.filter((i) => (i.severity === "high" || i.severity === "critical") && i.status !== "resolved");

  return (
    <AppLayout title="Alerts & Verification">
      <Tabs defaultValue="danger" className="mx-auto max-w-2xl">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="danger">Danger</TabsTrigger>
          <TabsTrigger value="verify">Verify</TabsTrigger>
          <TabsTrigger value="you">For you</TabsTrigger>
        </TabsList>

        <TabsContent value="danger" className="mt-4 grid gap-3">
          {danger.map((i) => <IncidentCard key={i.id} incident={i} userVote={votes[i.id] ?? null} onVote={(v) => vote(i, v)} />)}
          {danger.length === 0 && <Empty text="No high-risk alerts right now." />}
        </TabsContent>

        <TabsContent value="verify" className="mt-4 grid gap-3">
          {incidents.filter((i) => i.status === "pending").map((i) => (
            <IncidentCard key={i.id} incident={i} userVote={votes[i.id] ?? null} onVote={(v) => vote(i, v)} />
          ))}
          {incidents.filter((i) => i.status === "pending").length === 0 && <Empty text="Nothing to verify — all caught up!" />}
        </TabsContent>

        <TabsContent value="you" className="mt-4 grid gap-3">
          {notifs.map((n) => (
            <div key={n.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{n.title}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
              </div>
              {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
            </div>
          ))}
          {notifs.length === 0 && <Empty text="No personal notifications yet." />}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">{text}</p>;
}
