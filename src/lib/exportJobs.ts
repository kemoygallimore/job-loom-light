import type { SubmissionTableFilter } from "@/lib/leadFormSubmissionsTable";

export const EXPORT_WARN_ROW_COUNT = 5000;
export const EXPORT_HARD_ROW_COUNT = 25000;
export const EXPORT_RETENTION_DAYS = 7;

export type ExportType = "form_submissions" | "candidates" | "pipeline";
export type ExportScope = "current_view" | "full_dataset";
export type ExportStatus = "queued" | "running" | "completed" | "failed" | "expired" | "deleted";

export type FormSubmissionExportFilters = {
  formId: string;
  filters?: SubmissionTableFilter[];
};

export type CandidateExportFilters = {
  view?: "active" | "all";
  search?: string;
  stageFilter?: string;
  jobFilter?: string;
  parishFilter?: string;
  dateFrom?: string;
  dateTo?: string;
  repeatOnly?: boolean;
};

export type PipelineExportFilters = {
  jobId: string;
  search?: string;
  sort?: string;
  screeningStatus?: string;
  screeningMin?: string;
  screeningMax?: string;
};

export type ExportFilters = FormSubmissionExportFilters | CandidateExportFilters | PipelineExportFilters;

export type ExportJob = {
  id: string;
  company_id: string;
  requested_by: string | null;
  export_type: ExportType;
  scope: ExportScope;
  filters: unknown;
  filter_summary: string;
  status: ExportStatus;
  row_count: number;
  r2_bucket: string | null;
  r2_key: string | null;
  filename: string | null;
  expires_at: string | null;
  download_count: number;
  last_downloaded_by: string | null;
  last_downloaded_at: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  deleted_at: string | null;
};

export type RequestExportInput = {
  export_type: ExportType;
  scope: ExportScope;
  filters: ExportFilters;
};

export type RequestExportResult = {
  success: true;
  job: ExportJob;
  warning?: string | null;
};

const EXPORT_TYPE_LABELS: Record<ExportType, string> = {
  form_submissions: "Form submissions",
  candidates: "Candidates",
  pipeline: "Pipeline",
};

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

export function exportTypeLabel(type: ExportType) {
  return EXPORT_TYPE_LABELS[type];
}

export function serializeDateFilter(date?: Date) {
  return date ? date.toISOString() : undefined;
}

export function normalizeFullDatasetFilters(exportType: ExportType, filters: ExportFilters): ExportFilters {
  if (exportType === "form_submissions") {
    return { formId: (filters as FormSubmissionExportFilters).formId };
  }
  if (exportType === "pipeline") {
    const pipelineFilters = filters as PipelineExportFilters;
    return {
      jobId: pipelineFilters.jobId,
      sort: pipelineFilters.sort,
    };
  }
  return {};
}

export function shouldWarnForRowCount(rowCount: number) {
  return rowCount > EXPORT_WARN_ROW_COUNT && rowCount <= EXPORT_HARD_ROW_COUNT;
}

export function ensureExportAllowed(rowCount: number) {
  if (rowCount > EXPORT_HARD_ROW_COUNT) {
    throw new Error(`Exports are capped at ${EXPORT_HARD_ROW_COUNT.toLocaleString()} rows. Narrow the filters and try again.`);
  }
}

export function buildSafeExportFilename(base: string, date = new Date()) {
  const yyyyMmDd = date.toISOString().slice(0, 10);
  const slug = base
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "export";
  return `${slug}-${yyyyMmDd}.xlsx`;
}

export async function requestExport(input: RequestExportInput): Promise<RequestExportResult> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.functions.invoke<RequestExportResult>("request-export", {
    body: input,
  });

  if (error) throw new Error(errorMessage(error, "Could not request export"));
  if (!data?.success) throw new Error("Could not request export");
  return data;
}

export async function getExportDownloadUrl(jobId: string) {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>("get-export-download-url", {
    body: { export_job_id: jobId },
  });

  if (error) throw new Error(errorMessage(error, "Could not get download URL"));
  if (data?.error) throw new Error(data.error);
  if (!data?.url) throw new Error("Download URL was not returned");
  return data.url;
}

export async function deleteExportFile(jobId: string) {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.functions.invoke<{ success?: boolean; error?: string }>("delete-export-file", {
    body: { export_job_id: jobId },
  });

  if (error) throw new Error(errorMessage(error, "Could not delete export file"));
  if (data?.error) throw new Error(data.error);
  if (!data?.success) throw new Error("Could not delete export file");
}
