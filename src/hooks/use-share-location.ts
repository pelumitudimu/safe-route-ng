import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface LocationState {
  sharing: boolean;
  updatedAt: string | null;
  loading: boolean;
}

/**
 * Manages the current user's live-location row used for family & friends
 * sharing. Pushes a fresh GPS fix when sharing is enabled.
 */
export function useShareLocation() {
  const { user } = useAuth();
  const [state, setState] = useState<LocationState>({
    sharing: false,
    updatedAt: null,
    loading: true,
  });

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_locations")
      .select("sharing_enabled, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    setState({
      sharing: data?.sharing_enabled ?? false,
      updatedAt: data?.updated_at ?? null,
      loading: false,
    });
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pushLocation = useCallback(
    async (sharing: boolean) => {
      if (!user) return;
      const write = async (lat: number | null, lon: number | null) => {
        await supabase.from("user_locations").upsert(
          {
            user_id: user.id,
            latitude: lat,
            longitude: lon,
            sharing_enabled: sharing,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        await refresh();
      };
      if (!sharing) {
        await write(null, null);
        return;
      }
      return new Promise<void>((resolve) => {
        navigator.geolocation?.getCurrentPosition(
          async (p) => {
            await write(p.coords.latitude, p.coords.longitude);
            resolve();
          },
          async () => {
            await write(null, null);
            resolve();
          },
          { timeout: 8000, enableHighAccuracy: true },
        );
      });
    },
    [user, refresh],
  );

  // Periodically refresh GPS while sharing is on.
  useEffect(() => {
    if (!state.sharing || !user) return;
    const id = setInterval(() => pushLocation(true), 60_000);
    return () => clearInterval(id);
  }, [state.sharing, user, pushLocation]);

  return { ...state, setSharing: pushLocation, refresh };
}
