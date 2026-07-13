import type { Application } from "@/pages/Pipeline";
import { User, Briefcase } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTagColorClasses, type CandidateTag } from "@/lib/candidateTags";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  app: Application;
  isDragging: boolean;
  selected?: boolean;
  onToggle?: (id: string, checked: boolean) => void;
}

export default function KanbanCard({ app, isDragging, selected, onToggle }: Props) {
  const [tags, setTags] = useState<CandidateTag[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("candidate_tag_assignments")
        .select("tag:candidate_tags(id, company_id, label, color)")
        .eq("candidate_id", app.candidate_id);
      if (cancelled) return;
      setTags(((data as any[]) ?? []).map(r => r.tag).filter(Boolean));
    })();
    return () => { cancelled = true; };
  }, [app.candidate_id]);

  return (
    <div className={`kanban-card ${isDragging ? "dragging" : ""}`}>
      <div className="flex items-start gap-2.5">
        <div onClick={(e) => e.stopPropagation()} className="pt-1">
          <Checkbox checked={!!selected} onCheckedChange={(v) => onToggle?.(app.id, v === true)} />
        </div>
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{app.candidate?.name}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Briefcase className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{app.job?.title}</span>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {tags.map(t => (
                <span
                  key={t.id}
                  className={`inline-flex items-center rounded-full border text-[10px] px-1.5 py-0 font-medium ${getTagColorClasses(t.color)}`}
                >
                  {t.label}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
            {app.screening_score != null && (
              <>
                <span
                  className="rounded-full border px-2 py-0.5 font-medium tabular-nums"
                  aria-label={`Screening score ${Math.round(app.screening_score)} out of 100`}
                >
                  Screening {Math.round(app.screening_score)}/100
                </span>
                {app.screening_status ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                    {app.screening_status === "final" ? "Final" : "Provisional"}
                  </span>
                ) : null}
              </>
            )}
            {app.review_needed_count > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">Review needed</span>}
            {app.interview_average != null && <span className="rounded-full border px-2 py-0.5 font-medium tabular-nums">Interview {app.interview_average.toFixed(1)}/5</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
