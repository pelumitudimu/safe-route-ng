import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Send a family/friend circle connection request by email.
 * Looks up the target user server-side (service role) so client code never
 * sees other users' ids until a connection exists.
 */
export const sendCircleRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) =>
    z.object({ email: z.string().trim().email() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: targetId, error: lookupErr } = await supabaseAdmin.rpc(
      "lookup_user_by_email",
      { _email: data.email },
    );
    if (lookupErr) throw new Error("Could not look up that email");
    if (!targetId) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (targetId === userId) {
      return { ok: false as const, reason: "self" as const };
    }

    // Already connected (either direction)?
    const { data: existing } = await supabase
      .from("circle_connections")
      .select("id, status, requester_id, addressee_id")
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${userId})`,
      )
      .maybeSingle();

    if (existing) {
      return { ok: false as const, reason: "exists" as const, status: existing.status };
    }

    const { error: insertErr } = await supabase
      .from("circle_connections")
      .insert({ requester_id: userId, addressee_id: targetId, status: "pending" });
    if (insertErr) throw new Error(insertErr.message);

    // Notify the recipient (RLS-safe: handled via admin since target != caller)
    await supabaseAdmin.from("notifications").insert({
      user_id: targetId,
      title: "New circle request",
      body: "Someone wants to add you to their safety circle. Open Family & Friends to respond.",
      type: "info",
    });

    return { ok: true as const };
  });
