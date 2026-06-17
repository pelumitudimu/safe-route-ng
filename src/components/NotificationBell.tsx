import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/safety";
import { toast } from "sonner";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  type: string;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const seenIds = useRef<Set<string> | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, type, read, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    const next = data ?? [];
    // On first load, prime the seen set without toasting existing notifications.
    if (seenIds.current === null) {
      seenIds.current = new Set(next.map((n) => n.id));
    } else {
      for (const n of next) {
        if (!seenIds.current.has(n.id)) {
          seenIds.current.add(n.id);
          toast(n.title, { description: n.body ?? undefined });
        }
      }
    }
    setItems(next);
  };

  useEffect(() => {
    seenIds.current = null;
    load();
    if (!user) return;
    // Poll for new notifications (realtime is disabled on this table for privacy).
    const interval = setInterval(load, 20_000);
    return () => clearInterval(interval);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const unread = items.filter((i) => !i.read).length;

  const markAll = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={markAll}>
              <Check className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications yet</p>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={`border-b border-border/50 px-4 py-3 ${n.read ? "opacity-70" : "bg-primary/5"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{n.title}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                </div>
                {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
              </div>
            ))
          )}
        </ScrollArea>
        <Link to="/alerts" className="block border-t border-border px-4 py-2.5 text-center text-xs font-medium text-primary hover:underline">
          View all alerts
        </Link>
      </PopoverContent>
    </Popover>
  );
}
