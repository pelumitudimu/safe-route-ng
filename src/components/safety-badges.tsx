import { cn } from "@/lib/utils";
import {
  SEVERITY_META,
  STATUS_META,
  type IncidentSeverity,
  type IncidentStatus,
  type RiskLevel,
} from "@/lib/safety";

const tokenClasses: Record<string, string> = {
  safe: "bg-safe/15 text-safe border-safe/30",
  caution: "bg-caution/15 text-caution border-caution/30",
  danger: "bg-danger/15 text-danger border-danger/30",
  critical: "bg-critical/15 text-critical border-critical/30",
  muted: "bg-muted text-muted-foreground border-border",
};

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const meta = SEVERITY_META[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        tokenClasses[meta.token],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tokenClasses[meta.token],
      )}
    >
      {meta.label}
    </span>
  );
}

export function RiskPill({ risk, className }: { risk: RiskLevel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        tokenClasses[risk.token],
        className,
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {risk.label} · {risk.score}
    </span>
  );
}
