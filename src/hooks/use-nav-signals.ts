import { useEffect, useId, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLiveIncidents } from "@/hooks/use-live-incidents";

/**
 * Live counts surfaced as badges across the app navigation:
 * - `recentIncidents`: incidents reported in the last 24 hours (live).
 * - `pendingCircle`: incoming Family & Friends requests awaiting a response.
 * - `unreadAlerts`: unread notifications.
 */
export function useNavSignals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const instanceId = useId();
  const { data: incidents } = useLiveIncidents(500);

  const recentIncidents = useMemo(() => {
    if (!incidents) return 0;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return incidents.filter((i) => new Date(i.created_at).getTime() >= cutoff)
      .length;
  }, [incidents]);

  const { data: pendingCircle = 0 } = useQuery({
    queryKey: ["nav-pending-circle", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const { count } = await supabase
        .from("circle_connections")
        .select("id", { count: "exact", head: true })
        .eq("addressee_id", user!.id)
        .eq("status", "pending");
      return count ?? 0;
    },
  });

  const { data: unreadAlerts = 0 } = useQuery({
    queryKey: ["nav-unread-alerts", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      return count ?? 0;
    },
  });

  // Keep circle + alerts counts fresh when new rows arrive in real time.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`nav-signals:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_connections" },
        () =>
          queryClient.invalidateQueries({ queryKey: ["nav-pending-circle"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () =>
          queryClient.invalidateQueries({ queryKey: ["nav-unread-alerts"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, instanceId]);

  return { recentIncidents, pendingCircle, unreadAlerts };
}
