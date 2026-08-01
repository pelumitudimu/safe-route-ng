import { BookOpen, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Switches an incident feed between the standard card layout and a
 * distraction-free reading view.
 */
export function ReaderModeToggle({
  reader,
  onToggle,
  className,
}: {
  reader: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <Button
      variant={reader ? "secondary" : "ghost"}
      size="sm"
      onClick={onToggle}
      aria-pressed={reader}
      title={reader ? "Switch to card view" : "Switch to reader mode"}
      className={cn("gap-1.5", className)}
    >
      {reader ? <LayoutGrid className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
      <span className="hidden sm:inline">{reader ? "Cards" : "Reader"}</span>
    </Button>
  );
}
