import type { Application } from "@/pages/Pipeline";
import { User, Briefcase } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTagColorClasses, type CandidateTag } from "@/lib/candidateTags";

interface Props {
  app: Application;
  isDragging: boolean;
}

export default function KanbanCard({ app, isDragging }: Props) {
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
        </div>
      </div>
    </div>
  );
}
