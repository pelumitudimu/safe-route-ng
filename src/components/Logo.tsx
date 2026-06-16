import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
        <ShieldCheck className="h-5 w-5" />
      </span>
      {showText && (
        <span className="font-display text-lg font-bold tracking-tight">
          Safe<span className="text-primary">Route</span>
        </span>
      )}
    </span>
  );
}
