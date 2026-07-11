type PipelineFilters = {
  search: string;
  screeningMax: string;
  screeningMin: string;
  screeningStatus: string;
  sort: string;
};

type CandidateFilters = {
  dateFrom?: string;
  dateTo?: string;
  jobFilter: string;
  parishFilter: string;
  repeatOnly: boolean;
  search: string;
  stageFilter: string;
};

export const keys = {
  all: ["app"] as const,
  candidate: (id: string | undefined) => [...keys.all, "candidate", id ?? ""] as const,
  candidateOptions: () => [...keys.all, "candidate-options"] as const,
  candidates: (view: "active" | "all", filters: CandidateFilters) =>
    [...keys.all, "candidates", view, filters] as const,
  jobsOpen: () => [...keys.all, "jobs", "open"] as const,
  pipeline: (jobId: string, filters: PipelineFilters) =>
    [...keys.all, "pipeline", jobId, filters] as const,
  tags: (candidateIds: string[]) => [...keys.all, "tags", [...candidateIds].sort()] as const,
};

export type { CandidateFilters, PipelineFilters };
