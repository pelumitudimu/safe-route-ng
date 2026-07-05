import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

type ChatRequestBody = { messages?: unknown };

const SYSTEM_PROMPT = `You are the SafeRoute Nigeria Assistant, a calm, practical safety companion inside a personal-safety app used across Nigeria.

Your job is to help users stay safe by any means the app allows:
- Answer questions about safety in specific Nigerian areas using LIVE incident data. Always call the "lookup_incidents" tool before making claims about whether an area is safe or what has been happening recently. Never invent incidents.
- When you use incident data, summarise clearly: how many recent reports, their categories/severity, and roughly when/where. Be honest when there is little or no data ("I don't have recent reports for that area" — do not imply it is therefore safe).
- Give concrete personal-safety guidance: what to do during robbery, kidnapping, unrest, road travel, night movement, etc.
- Explain how to use the app's features: reporting incidents, the Emergency SOS button, Safe Route planning, and the Family & Friends circle.

Style: warm, direct, and concise. Use short paragraphs and bullet points. Nigerian context and place names. In a genuine emergency, tell the user to use the SOS button and call local emergency services immediately. You are not a substitute for the police or emergency responders.`;

function supabasePublic() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const lookupIncidents = tool({
  description:
    "Look up recent, real safety incidents reported in the app. Use this to answer questions about how safe an area is or what has been happening. Returns the most recent matching incidents.",
  inputSchema: z.object({
    location: z
      .string()
      .describe(
        "Optional place name to filter by, e.g. 'Lekki', 'Kaduna', 'Wuse'. Leave empty for nationwide.",
      )
      .optional(),
    category: z
      .enum([
        "robbery",
        "kidnapping",
        "assault",
        "theft",
        "accident",
        "protest",
        "fire",
        "other",
      ])
      .describe("Optional incident category to filter by.")
      .optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(25)
      .describe("How many incidents to return (default 10).")
      .optional(),
  }),
  execute: async ({ location, category, limit }) => {
    const supabase = supabasePublic();
    let query = supabase
      .from("incidents")
      .select("title, category, severity, status, address, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);

    if (location && location.trim()) {
      query = query.or(
        `address.ilike.%${location.trim()}%,title.ilike.%${location.trim()}%`,
      );
    }
    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) return { error: error.message, incidents: [] };
    return {
      count: data?.length ?? 0,
      incidents: data ?? [],
    };
  },
});

async function persistMessage(
  authHeader: string | null,
  message: UIMessage,
) {
  if (!authHeader?.startsWith("Bearer ")) return;
  const token = authHeader.slice(7);
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    },
  );
  const { data: userData } = await supabase.auth.getUser(token);
  const userId = userData.user?.id;
  if (!userId) return;

  await supabase.from("assistant_messages").insert({
    user_id: userId,
    role: message.role,
    parts: message.parts as unknown as Database["public"]["Tables"]["assistant_messages"]["Insert"]["parts"],
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        const messages = body.messages as UIMessage[];

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const authHeader = request.headers.get("authorization");

        // Persist the user's newly sent message.
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.role === "user") {
          await persistMessage(authHeader, lastMessage);
        }

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM_PROMPT,
          messages: convertToModelMessages(messages),
          tools: { lookup_incidents: lookupIncidents },
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage }) => {
            await persistMessage(authHeader, responseMessage);
          },
        });
      },
    },
  },
});
