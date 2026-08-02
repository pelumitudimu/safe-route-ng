import { createFileRoute } from "@tanstack/react-router";

// Auto-ingest recent, documented Nigerian security incidents every minute.
// Flow: Firecrawl news search -> Lovable AI structured extraction -> geocode -> insert.
// Placed under /api/public so pg_cron can call it without an auth session.
// A lightweight shared-secret (the project anon key in the `apikey` header) gates it.

type IncidentCategory =
  | "robbery"
  | "kidnapping"
  | "assault"
  | "theft"
  | "accident"
  | "protest"
  | "fire"
  | "fraud"
  | "harassment"
  | "other";
type IncidentSeverity = "low" | "medium" | "high" | "critical";

const CATEGORIES: IncidentCategory[] = [
  "robbery",
  "kidnapping",
  "assault",
  "theft",
  "accident",
  "protest",
  "fire",
  "fraud",
  "harassment",
  "other",
];
const SEVERITIES: IncidentSeverity[] = ["low", "medium", "high", "critical"];
const MAX_SIGNAL_QUERIES_PER_RUN = 4;
const FIRECRAWL_TIMEOUT_MS = 12_000;
const AI_TIMEOUT_MS = 35_000;
const GEOCODE_TIMEOUT_MS = 6_000;

interface ExtractedIncident {
  title: string;
  description: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  location: string; // specific place in Nigeria, e.g. "Ikeja, Lagos"
  source_url: string;
}

const NIGERIA_BOUNDS = { minLat: 4, maxLat: 14, minLon: 2.5, maxLon: 15 };

// A broad set of news signals so the feed stays comprehensive and up to date:
// different incident types, major regions, and general safety coverage. Each
// runs as its own Firecrawl news search and the results are merged + deduped.
const NEWS_SIGNALS: string[] = [
  "Nigeria kidnapping abduction latest news",
  "Nigeria armed robbery attack latest news",
  "Nigeria banditry herdsmen attack latest news",
  "Nigeria terrorism Boko Haram ISWAP attack news",
  "Nigeria communal clash violence killed news",
  "Nigeria road accident crash casualties news",
  "Nigeria fire explosion disaster news",
  "Nigeria protest unrest security news",
  "Lagos crime security incident news",
  "Abuja FCT security incident news",
  "Rivers Port Harcourt crime security news",
  "Kaduna Katsina Zamfara Sokoto security attack news",
  "Borno Yobe Adamawa security attack news",
  "Anambra Imo Enugu southeast security news",
  "Punch Nigeria crime kidnapping police latest",
  "Channels TV Nigeria security incident latest",
  "Daily Trust Nigeria bandits kidnapping latest",
  "Vanguard Nigeria crime police latest",
  "Premium Times Nigeria insecurity attack latest",
  "TheCable Nigeria police attack incident latest",
  "FRSC Nigeria road crash casualties latest",
  "NEMA Nigeria fire explosion emergency latest",
];

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function getSignalsForThisRun(): string[] {
  // Rotate through the full signal list so each minute stays fast enough for
  // cron while still covering every source group over a few runs.
  const start = new Date().getUTCMinutes() % NEWS_SIGNALS.length;
  return Array.from({ length: MAX_SIGNAL_QUERIES_PER_RUN }, (_, index) => {
    return NEWS_SIGNALS[(start + index) % NEWS_SIGNALS.length];
  });
}

async function firecrawlSearchOne(apiKey: string, query: string): Promise<string> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      "https://api.firecrawl.dev/v2/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          limit: 4,
          lang: "en",
          country: "ng",
          tbs: "qdr:d", // past day, so the app feels up to date
          sources: ["news"],
          scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
        }),
      },
      FIRECRAWL_TIMEOUT_MS,
    );
  } catch (err) {
    console.error(
      `[ingest-incidents] Firecrawl search timed out for "${query}":`,
      err instanceof Error ? err.message : err,
    );
    return "";
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(
      `[ingest-incidents] Firecrawl search failed for "${query}" (${res.status}): ${text.slice(0, 200)}`,
    );
    if (res.status === 402) {
      throw new Error(
        "News provider out of credits (HTTP 402). Top up the Firecrawl plan to resume live ingestion.",
      );
    }
    return "";
  }
  const data = (await res.json()) as {
    data?:
      | Array<{ title?: string; url?: string; markdown?: string; snippet?: string; description?: string }>
      | {
          news?: Array<{ title?: string; url?: string; markdown?: string; snippet?: string }>;
          web?: Array<{ title?: string; url?: string; markdown?: string; description?: string }>;
        };
    news?: Array<{ title?: string; url?: string; markdown?: string; snippet?: string }>;
    web?: Array<{ title?: string; url?: string; markdown?: string; description?: string }>;
  };
  const results = Array.isArray(data.data)
    ? data.data
    : [
        ...(data.data?.news ?? data.news ?? []),
        ...(data.data?.web ?? data.web ?? []),
      ];
  return results
    .map((r) => {
      const url = r.url ?? "";
      const title = r.title ?? "";
      const body =
        ("markdown" in r && r.markdown) ||
        ("snippet" in r && r.snippet) ||
        ("description" in r && (r as { description?: string }).description) ||
        "";
      return `SOURCE_URL: ${url}\nTITLE: ${title}\nCONTENT: ${String(body).slice(0, 2000)}`;
    })
    .join("\n\n---\n\n");
}

async function firecrawlSearchNews(apiKey: string): Promise<string> {
  // Run every signal in parallel, then merge and dedupe by SOURCE_URL so we
  // don't feed the same article to the extractor twice.
  const settled = await Promise.allSettled(
    getSignalsForThisRun().map((q) => firecrawlSearchOne(apiKey, q)),
  );
  const blocks: string[] = [];
  const seen = new Set<string>();
  for (const outcome of settled) {
    if (outcome.status !== "fulfilled" || !outcome.value) continue;
    for (const block of outcome.value.split("\n\n---\n\n")) {
      const match = block.match(/^SOURCE_URL:\s*(.+)$/m);
      const url = match?.[1]?.trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      blocks.push(block);
    }
  }
  return blocks.join("\n\n---\n\n");
}

async function extractIncidents(
  lovableKey: string,
  newsText: string,
): Promise<ExtractedIncident[]> {
  const system = `You extract real, documented Nigerian security incidents from news text.
Return ONLY incidents that clearly happened in Nigeria recently, preferably from the last 30 days.
For each incident output a JSON object with:
- title: short factual headline (max 90 chars)
- description: 1-2 sentence factual summary
- category: one of ${CATEGORIES.join(", ")}
- severity: one of ${SEVERITIES.join(", ")} (critical = mass casualty/major attack, high = violent crime with victims, medium = notable crime, low = minor)
- location: the most specific place named, formatted like "Area, State" in Nigeria
- source_url: the SOURCE_URL of the article it came from
Skip opinion pieces, roundups without a specific location, and anything outside Nigeria.
Respond as JSON: { "incidents": [ ... ] }`;

  const res = await fetchWithTimeout(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: newsText.slice(0, 30_000) },
        ],
        response_format: { type: "json_object" },
      }),
    },
    AI_TIMEOUT_MS,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI extraction failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  let parsed: { incidents?: ExtractedIncident[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed.incidents) ? parsed.incidents : [];
  return list.filter(
    (i) =>
      i &&
      typeof i.title === "string" &&
      typeof i.location === "string" &&
      typeof i.source_url === "string" &&
      CATEGORIES.includes(i.category) &&
      SEVERITIES.includes(i.severity),
  );
}

async function geocode(
  place: string,
): Promise<{ lat: number; lon: number; address: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ng&q=${encodeURIComponent(
      place,
    )}`;
    const res = await fetchWithTimeout(
      url,
      {
        headers: { Accept: "application/json", "User-Agent": "SafeRouteNigeria/1.0" },
      },
      GEOCODE_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (!data.length) return null;
    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    if (
      lat < NIGERIA_BOUNDS.minLat ||
      lat > NIGERIA_BOUNDS.maxLat ||
      lon < NIGERIA_BOUNDS.minLon ||
      lon > NIGERIA_BOUNDS.maxLon
    )
      return null;
    return { lat, lon, address: data[0].display_name };
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/hooks/ingest-incidents")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        const provided =
          request.headers.get("apikey") ||
          request.headers.get("authorization")?.replace("Bearer ", "");
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const firecrawlKey = process.env.FIRECRAWL_API_KEY;
        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!firecrawlKey || !lovableKey) {
          return new Response(
            JSON.stringify({ error: "Missing FIRECRAWL_API_KEY or LOVABLE_API_KEY" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          const newsText = await firecrawlSearchNews(firecrawlKey);
          if (!newsText.trim()) {
            return Response.json({ ok: true, inserted: 0, note: "No news results" });
          }

          const extracted = await extractIncidents(lovableKey, newsText);
          if (!extracted.length) {
            return Response.json({ ok: true, inserted: 0, note: "Nothing to extract" });
          }

          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );

          // Skip source URLs we already have.
          const urls = Array.from(new Set(extracted.map((i) => i.source_url)));
          const { data: existing } = await supabaseAdmin
            .from("incidents")
            .select("source_url")
            .in("source_url", urls);
          const known = new Set((existing ?? []).map((r) => r.source_url));

          let inserted = 0;
          const skipped: string[] = [];
          for (const inc of extracted) {
            if (known.has(inc.source_url)) continue;
            const geo = await geocode(inc.location);
            if (!geo) {
              skipped.push(inc.location);
              continue;
            }
            const { error } = await supabaseAdmin.from("incidents").insert({
              reporter_id: null,
              category: inc.category,
              severity: inc.severity,
              title: inc.title.slice(0, 120),
              description: inc.description?.slice(0, 1000) ?? null,
              latitude: geo.lat,
              longitude: geo.lon,
              address: geo.address,
              status: "verified",
              source_url: inc.source_url,
            });
            if (!error) {
              inserted += 1;
              known.add(inc.source_url);
            }
          }

          return Response.json({
            ok: true,
            inserted,
            candidates: extracted.length,
            skipped_no_geo: skipped.length,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error("[ingest-incidents]", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
