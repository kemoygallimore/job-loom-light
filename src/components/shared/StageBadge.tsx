import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getStageColor, getStageLabel } from "@/lib/stages";

interface StageBadgeProps {
  stage: string | null | undefined;
  className?: string;
}

export default function StageBadge({ stage, className }: StageBadgeProps) {
  if (!stage) return <span className="text-muted-foreground text-sm">—</span>;

  return (
    <Badge variant="secondary" className={cn("capitalize text-xs font-medium", getStageColor(stage), className)}>
      {getStageLabel(stage)}
    </Badge>
  );
}
