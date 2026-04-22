import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";
import { getTagColorClasses, type CandidateTag } from "@/lib/candidateTags";

interface Props {
  candidateId: string;
  size?: "sm" | "md";
  showAddButton?: boolean;
}

export default function CandidateTagsBar({ candidateId, size = "md", showAddButton = true }: Props) {
  const { profile } = useAuth();
  const [assigned, setAssigned] = useState<{ assignmentId: string; tag: CandidateTag }[]>([]);
  const [library, setLibrary] = useState<CandidateTag[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!profile?.company_id) return;
    const [aRes, lRes] = await Promise.all([
      (supabase as any)
        .from("candidate_tag_assignments")
        .select("id, tag:candidate_tags(id, company_id, label, color)")
        .eq("candidate_id", candidateId),
      (supabase as any)
        .from("candidate_tags")
        .select("id, company_id, label, color")
        .eq("company_id", profile.company_id)
        .order("label"),
    ]);
    setAssigned(
      ((aRes.data as any[]) ?? [])
        .filter((r: any) => r.tag)
        .map((r: any) => ({ assignmentId: r.id, tag: r.tag })),
    );
    setLibrary((lRes.data as CandidateTag[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId, profile?.company_id]);

  const toggleTag = async (tag: CandidateTag, currentlyAssigned: boolean) => {
    if (!profile?.company_id) return;
    if (currentlyAssigned) {
      const row = assigned.find(a => a.tag.id === tag.id);
      if (!row) return;
      const { error } = await (supabase as any)
        .from("candidate_tag_assignments")
        .delete()
        .eq("id", row.assignmentId);
      if (error) { toast.error(error.message); return; }
      setAssigned(prev => prev.filter(a => a.tag.id !== tag.id));
    } else {
      const { data, error } = await (supabase as any)
        .from("candidate_tag_assignments")
        .insert({
          company_id: profile.company_id,
          candidate_id: candidateId,
          tag_id: tag.id,
          assigned_by: profile.user_id,
        })
        .select("id")
        .single();
      if (error) { toast.error(error.message); return; }
      setAssigned(prev => [...prev, { assignmentId: data.id, tag }]);
    }
  };

  const removeTag = async (assignmentId: string, tagId: string) => {
    const { error } = await (supabase as any)
      .from("candidate_tag_assignments")
      .delete()
      .eq("id", assignmentId);
    if (error) { toast.error(error.message); return; }
    setAssigned(prev => prev.filter(a => a.tag.id !== tagId));
  };

  const pillCls = size === "sm"
    ? "text-[10px] px-1.5 py-0.5 gap-1"
    : "text-xs px-2 py-0.5 gap-1";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {assigned.map(({ assignmentId, tag }) => (
        <span
          key={assignmentId}
          className={`inline-flex items-center rounded-full border font-medium ${pillCls} ${getTagColorClasses(tag.color)}`}
        >
          {tag.label}
          {showAddButton && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(assignmentId, tag.id); }}
              className="opacity-60 hover:opacity-100 transition-opacity"
              aria-label={`Remove tag ${tag.label}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}
      {showAddButton && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors text-xs px-2 py-0.5"
            >
              <Plus className="w-3 h-3" />
              Tag
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5">Apply tags</div>
            {library.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground flex items-center gap-2">
                <TagIcon className="w-3.5 h-3.5" />
                No tags yet. Ask an admin to create some.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {library.map(tag => {
                  const isOn = assigned.some(a => a.tag.id === tag.id);
                  return (
                    <label
                      key={tag.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={isOn}
                        onCheckedChange={() => toggleTag(tag, isOn)}
                      />
                      <span className={`inline-flex items-center rounded-full border text-[11px] px-2 py-0.5 font-medium ${getTagColorClasses(tag.color)}`}>
                        {tag.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}