import type { PipelineStage } from "@/lib/pipeline";

export type StageKey = PipelineStage | "interview";

export const PIPELINE_STAGES: PipelineStage[] = [
  "applied",
  "shortlisted",
  "screening",
  "scheduling",
  "1st_interview",
  "2nd_interview",
  "offer",
  "hired",
  "rejected",
];

export const STAGE_LABELS: Record<StageKey, string> = {
  applied: "Applied",
  shortlisted: "Shortlisted",
  screening: "Screening",
  scheduling: "Scheduling",
  "1st_interview": "1st Interview",
  "2nd_interview": "2nd Interview",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};

export const STAGE_COLORS: Record<StageKey, string> = {
  applied: "bg-muted text-muted-foreground",
  shortlisted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  screening: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  scheduling: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  "1st_interview": "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  "2nd_interview": "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400",
  interview: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  offer: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  hired: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export const STAGE_CHART_COLORS: Record<StageKey, string> = {
  applied: "hsl(220, 70%, 52%)",
  shortlisted: "hsl(160, 60%, 42%)",
  screening: "hsl(38, 92%, 50%)",
  scheduling: "hsl(190, 70%, 45%)",
  "1st_interview": "hsl(270, 50%, 52%)",
  "2nd_interview": "hsl(290, 55%, 50%)",
  interview: "hsl(270, 50%, 52%)",
  offer: "hsl(152, 55%, 42%)",
  hired: "hsl(142, 60%, 42%)",
  rejected: "hsl(4, 68%, 48%)",
};

export function getStageLabel(stage: string | null | undefined) {
  if (!stage) return "—";
  return STAGE_LABELS[stage as StageKey] ?? stage.replace(/_/g, " ");
}

export function getStageColor(stage: string | null | undefined) {
  if (!stage) return "";
  return STAGE_COLORS[stage as StageKey] ?? "";
}
