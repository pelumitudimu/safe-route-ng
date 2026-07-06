import { cn } from "@/lib/utils";

/**
 * Small "Live" status pill with a pulsing dot — signals that data updates
 * in real time.
 */
export function LiveIndicator({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-safe/30 bg-safe/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-safe",
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-safe opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-safe" />
      </span>
      Live
    </span>
  );
}
