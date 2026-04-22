import { supabase } from "@/integrations/supabase/client";

export interface CandidateTag {
  id: string;
  company_id: string;
  label: string;
  color: string;
}

export interface CandidateTagAssignment {
  id: string;
  candidate_id: string;
  tag_id: string;
  tag: CandidateTag;
}

export const TAG_COLORS = [
  { value: "red", label: "Red", classes: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800" },
  { value: "amber", label: "Amber", classes: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
  { value: "green", label: "Green", classes: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800" },
  { value: "blue", label: "Blue", classes: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
  { value: "violet", label: "Violet", classes: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800" },
  { value: "gray", label: "Gray", classes: "bg-muted text-muted-foreground border-border" },
] as const;

export function getTagColorClasses(color: string): string {
  return TAG_COLORS.find(c => c.value === color)?.classes ?? TAG_COLORS[5].classes;
}

/** Fetch all assignments for a list of candidates, joined with tag info. */
export async function fetchTagsForCandidates(
  candidateIds: string[],
): Promise<Map<string, CandidateTag[]>> {
  const map = new Map<string, CandidateTag[]>();
  if (candidateIds.length === 0) return map;
  const { data, error } = await (supabase as any)
    .from("candidate_tag_assignments")
    .select("candidate_id, tag:candidate_tags(id, company_id, label, color)")
    .in("candidate_id", candidateIds);
  if (error || !data) return map;
  for (const row of data as any[]) {
    if (!row.tag) continue;
    const list = map.get(row.candidate_id) ?? [];
    list.push(row.tag as CandidateTag);
    map.set(row.candidate_id, list);
  }
  return map;
}