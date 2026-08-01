import { CATEGORY_META, SEVERITY_META, timeAgo, type Incident } from "@/lib/safety";

/**
 * Distraction-free reading view: incidents rendered as a quiet, typographic
 * article list — no photos, badges, buttons or vote controls.
 */
export function IncidentReader({ incidents }: { incidents: Incident[] }) {
  if (incidents.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        Nothing to read here right now.
      </p>
    );
  }

  return (
    <article className="mx-auto max-w-prose divide-y divide-border">
      {incidents.map((inc) => {
        const cat = CATEGORY_META[inc.category] ?? CATEGORY_META.other;
        const sev = SEVERITY_META[inc.severity];
        return (
          <section key={inc.id} className="py-7 first:pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {cat.label} · {sev.label} · {timeAgo(inc.created_at)}
            </p>
            <h3 className="mt-2 text-balance font-display text-xl font-bold leading-snug md:text-2xl">
              {inc.title}
            </h3>
            {inc.description && (
              <p className="mt-3 text-[17px] leading-8 text-foreground/85">{inc.description}</p>
            )}
            {inc.address && (
              <p className="mt-3 text-sm italic text-muted-foreground">{inc.address}</p>
            )}
          </section>
        );
      })}
    </article>
  );
}
