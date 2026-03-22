import type { Application } from "@/pages/Pipeline";
import { User, Briefcase } from "lucide-react";

interface Props {
  app: Application;
  isDragging: boolean;
}

export default function KanbanCard({ app, isDragging }: Props) {
  return (
    <div className={`kanban-card ${isDragging ? "dragging" : ""}`}>
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{app.candidate?.name}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Briefcase className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{app.job?.title}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
