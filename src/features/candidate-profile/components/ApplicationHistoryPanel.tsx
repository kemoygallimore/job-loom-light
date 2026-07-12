import { Briefcase, Calendar, Clock } from "lucide-react";
import StageBadge from "@/components/shared/StageBadge";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PipelineStage } from "@/lib/pipeline";
import { PIPELINE_STAGES, STAGE_LABELS } from "@/lib/stages";
import type { ApplicationWithJob } from "../types";

type Props = {
  applications: ApplicationWithJob[];
  onStageChange: (appId: string, newStage: PipelineStage) => void;
};

export function ApplicationHistoryPanel({ applications, onStageChange }: Props) {
  if (applications.length === 0) return null;

  return (
    <div className="bg-card border rounded-xl p-6 space-y-4" style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Application History
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {applications.length} application{applications.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="relative">
        {applications.length > 1 && <div className="absolute left-[15px] top-6 bottom-6 w-px bg-border" />}
        <div className="space-y-0">
          {applications.map((app, index) => {
            const isLatest = index === 0;
            return (
              <div key={app.id} className="relative flex gap-4 py-3">
                <div className="relative z-10 flex-shrink-0 mt-0.5">
                  <div
                    className={`w-[30px] h-[30px] rounded-full flex items-center justify-center ${isLatest ? "bg-primary/10 ring-2 ring-primary/20" : "bg-muted"}`}
                  >
                    <Briefcase className={`w-3.5 h-3.5 ${isLatest ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                </div>
                <div
                  className={`flex-1 rounded-lg p-3 ${isLatest ? "bg-primary/5 border border-primary/10" : "bg-muted/50"}`}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-medium truncate ${isLatest ? "text-foreground" : "text-foreground/80"}`}
                        >
                          {app.job_title}
                        </span>
                        {isLatest && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Latest
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Applied {new Date(app.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Updated {new Date(app.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StageBadge stage={app.stage} />
                      <Select value={app.stage} onValueChange={(v) => onStageChange(app.id, v as PipelineStage)}>
                        <SelectTrigger className="w-[120px] h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PIPELINE_STAGES.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {STAGE_LABELS[s] ?? s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
