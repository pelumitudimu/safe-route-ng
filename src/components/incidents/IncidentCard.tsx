import { MapPin, ThumbsUp, ThumbsDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CATEGORY_META, timeAgo, type Incident } from "@/lib/safety";
import { SeverityBadge, StatusBadge } from "@/components/safety-badges";
import { useSignedUrl } from "@/hooks/use-signed-url";

interface Props {
  incident: Incident;
  userVote?: "confirm" | "dispute" | null;
  onVote?: (vote: "confirm" | "dispute") => void;
  compact?: boolean;
}

export function IncidentCard({ incident, userVote, onVote, compact }: Props) {
  const meta = CATEGORY_META[incident.category];
  const Icon = meta.icon;
  const photo = useSignedUrl(incident.photo_url);

  return (
    <Card className="overflow-hidden border-border/70 bg-card/80 p-0 shadow-card transition-colors hover:border-primary/40">
      <div className="flex gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-semibold text-card-foreground">{incident.title}</h3>
            <span className="shrink-0 text-xs text-muted-foreground">
              {timeAgo(incident.created_at)}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {meta.label}
            </span>
            <SeverityBadge severity={incident.severity} />
            <StatusBadge status={incident.status} />
          </div>
          {!compact && incident.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{incident.description}</p>
          )}
          {incident.address && (
            <p className="mt-2 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{incident.address}</span>
            </p>
          )}
        </div>
      </div>

      {!compact && photo && (
        <img
          src={photo}
          alt={incident.title}
          loading="lazy"
          className="max-h-56 w-full object-cover"
        />
      )}

      {onVote && (
        <div className="flex items-center gap-2 border-t border-border/60 px-4 py-2.5">
          <span className="mr-auto text-xs text-muted-foreground">Is this accurate?</span>
          <Button
            size="sm"
            variant={userVote === "confirm" ? "default" : "outline"}
            onClick={() => onVote("confirm")}
            className={cn("h-8 gap-1.5", userVote === "confirm" && "bg-safe text-safe-foreground hover:bg-safe/90")}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            {incident.confirm_count}
          </Button>
          <Button
            size="sm"
            variant={userVote === "dispute" ? "default" : "outline"}
            onClick={() => onVote("dispute")}
            className={cn("h-8 gap-1.5", userVote === "dispute" && "bg-danger text-danger-foreground hover:bg-danger/90")}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            {incident.dispute_count}
          </Button>
        </div>
      )}
    </Card>
  );
}
