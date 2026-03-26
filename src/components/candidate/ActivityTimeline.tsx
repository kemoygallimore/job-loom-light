import { Badge } from "@/components/ui/badge";
import { UserPlus, Briefcase, MessageSquare, FileText, Clock } from "lucide-react";

export interface TimelineEvent {
  id: string;
  type: "created" | "applied" | "note" | "resume";
  title: string;
  description?: string;
  timestamp: string;
  meta?: string;
}

const EVENT_CONFIG: Record<TimelineEvent["type"], { icon: typeof UserPlus; color: string; label: string }> = {
  created: { icon: UserPlus, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: "Created" },
  applied: { icon: Briefcase, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "Application" },
  note: { icon: MessageSquare, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", label: "Note" },
  resume: { icon: FileText, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", label: "Resume" },
};

interface Props {
  events: TimelineEvent[];
}

export default function ActivityTimeline({ events }: Props) {
  if (events.length === 0) return null;

  return (
    <div className="bg-card border rounded-xl p-6 space-y-4" style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activity Timeline</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{events.length} event{events.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="relative">
        {events.length > 1 && (
          <div className="absolute left-[15px] top-6 bottom-6 w-px bg-border" />
        )}

        <div className="space-y-0">
          {events.map((event, idx) => {
            const config = EVENT_CONFIG[event.type];
            const Icon = config.icon;
            return (
              <div key={event.id} className="relative flex gap-4 py-2.5">
                <div className="relative z-10 flex-shrink-0 mt-0.5">
                  <div className={`w-[30px] h-[30px] rounded-full flex items-center justify-center ${idx === 0 ? "ring-2 ring-primary/20" : ""} ${config.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{event.title}</span>
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${config.color}`}>
                      {config.label}
                    </Badge>
                  </div>
                  {event.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Clock className="w-3 h-3" />
                    {new Date(event.timestamp).toLocaleString()}
                    {event.meta && <span className="ml-2">· {event.meta}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
