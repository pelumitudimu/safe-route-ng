import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Json[];
}

interface StoredRow {
  id: string;
  role: "user" | "assistant" | "system";
  parts: unknown;
  created_at: string;
}

/** Load the signed-in user's ongoing assistant conversation. */
export const getAssistantMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AssistantMessage[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("assistant_messages")
      .select("id, role, parts, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return (data as StoredRow[]).map((row) => ({
      id: row.id,
      role: row.role,
      parts: Array.isArray(row.parts) ? (row.parts as Array<Record<string, unknown>>) : [],
    }));
  });

/** Clear the whole conversation for the signed-in user. */
export const clearAssistantMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("assistant_messages")
      .delete()
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });
