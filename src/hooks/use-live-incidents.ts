import { useEffect, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Incident } from "@/lib/safety";

/**
 * Shared source of truth for incident data. Fetches once, keeps the list
 * fresh in real time via a Supabase realtime subscription, and falls back to
 * a short polling interval so the feed always feels live.
 */
export function useLiveIncidents(limit = 500) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["incidents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("incidents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data ?? []) as Incident[];
    },
    // Realtime keeps this current; polling is a safety net for dropped sockets.
    refetchInterval: 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const channel = supabase
      .channel("incidents-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["incidents"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
