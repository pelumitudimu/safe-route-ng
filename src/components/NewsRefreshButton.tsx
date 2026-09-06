import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

/**
 * Manually pulls in the latest Nigerian security news. Useful when the
 * automatic feed seems stale — runs the same pipeline the cron job uses.
 */
export function NewsRefreshButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    toast.info("Fetching the latest security news…");
    try {
      const res = await fetch("/api/public/hooks/ingest-incidents", {
        method: "POST",
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      await supabase.from("incidents").select("id", { count: "exact", head: true });
      await queryClient.invalidateQueries({ queryKey: ["incidents"] });

      if (data.inserted > 0) {
        toast.success(`Added ${data.inserted} new incident${data.inserted === 1 ? "" : "s"} from the news.`);
      } else {
        toast.success("Feed is up to date — no new incidents found right now.");
      }
    } catch (err) {
      toast.error(`Couldn't refresh news: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={refresh}
      disabled={busy}
      className={cn("gap-1.5", className)}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
      {busy ? "Refreshing…" : "Refresh news"}
    </Button>
  );
}
