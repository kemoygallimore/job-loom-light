// Supabase Edge Function: request-export
//
// Required secrets:
//   R2_WORKER_BASE_URL = https://api.rizonhire.com
//   R2_WORKER_SECRET   = <Cloudflare Worker shared secret>
//   R2_EXPORTS_BUCKET  = <private exports bucket name>
// Auto-provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import writeXlsxFile from "npm:write-excel-file@4.1.1/universal";

const WARN_ROW_COUNT = 5000;
const HARD_ROW_COUNT = 25000;
const RETENTION_DAYS = 7;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ExportType = "form_submissions" | "candidates" | "pipeline";
type ExportScope = "current_view" | "full_dataset";
type Cell = Record<string, unknown>;
type Row = Cell[];

type AuthContext = {
  userId: string;
  companyId: string;
  admin: ReturnType<typeof createClient>;
};

type ExportBuild = {
  rows: Row[];
  rowCount: number;
  filename: string;
  filterSummary: string;
  columns: { width: number }[];
};

class RowCapExceeded extends Error {
  rowCount: number;
  filename: string;
  filterSummary: string;

  constructor(rowCount: number, filename: string, filterSummary: string) {
    super(`Exports are capped at ${HARD_ROW_COUNT.toLocaleString()} rows. Narrow the filters and try again.`);
    this.rowCount = rowCount;
    this.filename = filename;
    this.filterSummary = filterSummary;
  }
}

function assertUnderHardCap(rowCount: number, exportFilename: string, summary: string) {
  if (rowCount > HARD_ROW_COUNT) {
    throw new RowCapExceeded(rowCount, exportFilename, summary);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeText(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const text = Array.isArray(value) ? value.join(", ") : String(value);
  return /^[=+\-@]/.test(text.trimStart()) ? `'${text}` : text;
}

function textCell(value: unknown): Cell {
  return { type: String, value: safeText(value) };
}

function headerCell(value: string): Cell {
  return { ...textCell(value), fontWeight: "bold" };
}

function numberCell(value: unknown): Cell {
  const num = Number(value);
  return Number.isFinite(num) ? { type: Number, value: num } : textCell("");
}

function dateCell(value: unknown): Cell {
  if (!value) return textCell("");
  const date = new Date(String(value));
  return Number.isFinite(date.getTime())
    ? { type: Date, value: date, format: "mmm d, yyyy h:mm AM/PM" }
    : textCell(value);
}

function answerPreview(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value && typeof value === "object" && "fileName" in value) {
    return String((value as { fileName?: string }).fileName ?? "Uploaded file");
  }
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function isEmptyAnswer(value: unknown) {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === "object" && "fileName" in value) {
    return !String((value as { fileName?: string }).fileName ?? "").trim();
  }
  return value === null || value === undefined || String(value).trim() === "";
}

function safeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "export";
}

function filename(base: string) {
  return `${safeSlug(base)}-${new Date().toISOString().slice(0, 10)}.xlsx`;
}

function normalizeStatus(value: unknown) {
  return String(value ?? "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function filterSummary(type: ExportType, scope: ExportScope, filters: Record<string, unknown>) {
  if (scope === "full_dataset") return "Full dataset";
  if (type === "form_submissions") {
    const count = Array.isArray(filters.filters) ? filters.filters.length : 0;
    return count === 0 ? "All submissions for selected form" : `${count} submission filter${count === 1 ? "" : "s"}`;
  }
  if (type === "pipeline") {
    const parts = [
      filters.search ? "search" : null,
      filters.screeningStatus && filters.screeningStatus !== "all" ? `screening ${filters.screeningStatus}` : null,
      filters.screeningMin ? `min score ${filters.screeningMin}` : null,
      filters.screeningMax ? `max score ${filters.screeningMax}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : "All applications for selected job";
  }
  const parts = [
    filters.view === "all" ? "all candidates" : "active jobs",
    filters.search ? "search" : null,
    filters.stageFilter && filters.stageFilter !== "all" ? `stage ${filters.stageFilter}` : null,
    filters.jobFilter && filters.jobFilter !== "all" ? "job filter" : null,
    filters.parishFilter && filters.parishFilter !== "all" ? `parish ${filters.parishFilter}` : null,
    filters.dateFrom ? "from date" : null,
    filters.dateTo ? "to date" : null,
    filters.repeatOnly ? "repeat applicants" : null,
  ].filter(Boolean);
  return parts.join(", ");
}

function getFormFields(schema: unknown) {
  const fields = Array.isArray((schema as { fields?: unknown[] })?.fields)
    ? (schema as { fields: Array<Record<string, unknown>> }).fields
    : [];
  return fields.filter((field) => field.type !== "section" && typeof field.id === "string");
}

function formColumnValue(submission: Record<string, unknown>, columnId: string, fieldById: Map<string, Record<string, unknown>>) {
  if (columnId === "status") return submission.status;
  if (columnId === "submitted") return submission.created_at;
  if (columnId.startsWith("field:")) {
    const fieldId = columnId.slice("field:".length);
    if (!fieldById.has(fieldId)) return "";
    return (submission.answers as Record<string, unknown> | null)?.[fieldId];
  }
  return "";
}

function matchesFormFilter(
  submission: Record<string, unknown>,
  filter: Record<string, string>,
  fieldById: Map<string, Record<string, unknown>>,
) {
  const value = formColumnValue(submission, filter.columnId, fieldById);
  const empty = isEmptyAnswer(value);
  if (filter.operator === "is_empty") return empty;
  if (filter.operator === "is_not_empty") return !empty;
  if (empty) return false;
  const filterValue = String(filter.value ?? "").trim();
  if (!filterValue) return true;
  if (filter.columnId === "submitted" && (filter.operator === "before" || filter.operator === "after")) {
    const valueTime = new Date(String(value)).getTime();
    const filterTime = new Date(filterValue).getTime();
    if (!Number.isFinite(valueTime) || !Number.isFinite(filterTime)) return false;
    return filter.operator === "before" ? valueTime < filterTime : valueTime > filterTime;
  }
  const left = answerPreview(value).toLowerCase();
  const right = filterValue.toLowerCase();
  return filter.operator === "equals" ? left === right : left.includes(right);
}

async function buildFormExport(ctx: AuthContext, scope: ExportScope, filters: Record<string, unknown>): Promise<ExportBuild> {
  const formId = String(filters.formId ?? "");
  if (!formId) throw new Error("formId is required");

  const { data: form, error: formError } = await ctx.admin
    .from("lead_forms")
    .select("id,title,schema")
    .eq("id", formId)
    .eq("company_id", ctx.companyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (formError) throw formError;
  if (!form) throw new Error("Form not found");

  const { data, error } = await ctx.admin
    .from("lead_form_submissions")
    .select("id,status,created_at,answers")
    .eq("form_id", formId)
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const fields = getFormFields(form.schema);
  const fieldById = new Map(fields.map((field) => [String(field.id), field]));
  const activeFilters = scope === "current_view" && Array.isArray(filters.filters)
    ? (filters.filters as Array<Record<string, string>>).filter((item) => item.columnId && item.operator)
    : [];
  const submissions = activeFilters.length
    ? (data ?? []).filter((submission) => activeFilters.every((filter) => matchesFormFilter(submission, filter, fieldById)))
    : (data ?? []);
  const exportFilename = filename(`${form.title}-submissions`);
  const summary = filterSummary("form_submissions", scope, filters);
  assertUnderHardCap(submissions.length, exportFilename, summary);

  const headers = ["Submission ID", "Status", "Submitted At", ...fields.map((field) => String(field.label ?? field.id))];
  const rows = [
    headers.map(headerCell),
    ...submissions.map((submission) => [
      textCell(submission.id),
      textCell(normalizeStatus(submission.status)),
      dateCell(submission.created_at),
      ...fields.map((field) => textCell(answerPreview((submission.answers as Record<string, unknown> | null)?.[String(field.id)]))),
    ]),
  ];

  return {
    rows,
    rowCount: submissions.length,
    filename: exportFilename,
    filterSummary: summary,
    columns: headers.map((header, index) => ({ width: index < 3 ? [38, 14, 24][index] : Math.min(Math.max(header.length + 4, 16), 42) })),
  };
}

async function buildCandidatesExport(ctx: AuthContext, scope: ExportScope, filters: Record<string, unknown>): Promise<ExportBuild> {
  const [candidateRes, appRes, tagRes] = await Promise.all([
    ctx.admin.from("candidates").select("id,company_id,name,email,phone,country,parish_state,created_at").eq("company_id", ctx.companyId).order("created_at", { ascending: false }),
    ctx.admin.from("applications").select("id,candidate_id,stage,updated_at,created_at,job_id,jobs(title,status)").eq("company_id", ctx.companyId).order("updated_at", { ascending: false }),
    ctx.admin.from("candidate_tag_assignments").select("candidate_id,candidate_tags(label)").eq("company_id", ctx.companyId),
  ]);
  if (candidateRes.error) throw candidateRes.error;
  if (appRes.error) throw appRes.error;
  if (tagRes.error) throw tagRes.error;

  const appsByCandidate = new Map<string, Array<Record<string, unknown>>>();
  for (const app of (appRes.data ?? []) as Array<Record<string, unknown>>) {
    const list = appsByCandidate.get(String(app.candidate_id)) ?? [];
    list.push(app);
    appsByCandidate.set(String(app.candidate_id), list);
  }

  const tagsByCandidate = new Map<string, string[]>();
  for (const row of (tagRes.data ?? []) as Array<{ candidate_id: string; candidate_tags?: { label?: string } | null }>) {
    const list = tagsByCandidate.get(row.candidate_id) ?? [];
    if (row.candidate_tags?.label) list.push(row.candidate_tags.label);
    tagsByCandidate.set(row.candidate_id, list);
  }

  let candidates = (candidateRes.data ?? []).map((candidate) => {
    const apps = appsByCandidate.get(candidate.id) ?? [];
    const latest = apps[0];
    const latestJob = latest?.jobs as { title?: string | null; status?: string | null } | null | undefined;
    return {
      ...candidate,
      latest_app_id: latest?.id ?? null,
      latest_job_id: latest?.job_id ?? null,
      latest_job_title: latestJob?.title ?? null,
      latest_job_status: latestJob?.status ?? null,
      latest_stage: latest?.stage ?? null,
      latest_updated_at: latest?.updated_at ?? null,
      application_count: apps.length,
      tags: tagsByCandidate.get(candidate.id) ?? [],
    };
  });

  if (scope === "current_view") {
    if (filters.view !== "all") candidates = candidates.filter((candidate) => candidate.latest_job_status === "open");
    const search = String(filters.search ?? "").trim().toLowerCase();
    if (search) {
      candidates = candidates.filter((candidate) =>
        candidate.name.toLowerCase().includes(search)
        || (candidate.email?.toLowerCase().includes(search) ?? false)
        || (candidate.phone?.includes(search) ?? false)
        || (candidate.latest_job_title?.toLowerCase().includes(search) ?? false)
      );
    }
    if (filters.stageFilter && filters.stageFilter !== "all") candidates = candidates.filter((candidate) => candidate.latest_stage === filters.stageFilter);
    if (filters.jobFilter && filters.jobFilter !== "all") candidates = candidates.filter((candidate) => candidate.latest_job_id === filters.jobFilter);
    if (filters.parishFilter && filters.parishFilter !== "all") candidates = candidates.filter((candidate) => (candidate.parish_state ?? "") === filters.parishFilter);
    if (filters.dateFrom) {
      const from = new Date(String(filters.dateFrom)).getTime();
      if (Number.isFinite(from)) candidates = candidates.filter((candidate) => new Date(candidate.latest_updated_at ?? candidate.created_at).getTime() >= from);
    }
    if (filters.dateTo) {
      const to = new Date(String(filters.dateTo));
      to.setHours(23, 59, 59, 999);
      if (Number.isFinite(to.getTime())) candidates = candidates.filter((candidate) => new Date(candidate.latest_updated_at ?? candidate.created_at).getTime() <= to.getTime());
    }
    if (filters.repeatOnly) candidates = candidates.filter((candidate) => candidate.application_count > 1);
  }
  const exportFilename = filename("candidates-export");
  const summary = filterSummary("candidates", scope, filters);
  assertUnderHardCap(candidates.length, exportFilename, summary);

  const headers = ["Candidate ID", "Name", "Email", "Phone", "Country", "Parish/State", "Latest Job", "Latest Job Status", "Latest Stage", "Latest Updated At", "Application Count", "Tags", "Created At"];
  const rows = [
    headers.map(headerCell),
    ...candidates.map((candidate) => [
      textCell(candidate.id),
      textCell(candidate.name),
      textCell(candidate.email),
      textCell(candidate.phone),
      textCell(candidate.country),
      textCell(candidate.parish_state),
      textCell(candidate.latest_job_title),
      textCell(normalizeStatus(candidate.latest_job_status)),
      textCell(normalizeStatus(candidate.latest_stage)),
      dateCell(candidate.latest_updated_at),
      numberCell(candidate.application_count),
      textCell(candidate.tags.join(", ")),
      dateCell(candidate.created_at),
    ]),
  ];

  return {
    rows,
    rowCount: candidates.length,
    filename: exportFilename,
    filterSummary: summary,
    columns: headers.map((header) => ({ width: Math.min(Math.max(header.length + 4, 16), 36) })),
  };
}

async function buildPipelineExport(ctx: AuthContext, scope: ExportScope, filters: Record<string, unknown>): Promise<ExportBuild> {
  const jobId = String(filters.jobId ?? "");
  if (!jobId) throw new Error("jobId is required");

  const { data: job, error: jobError } = await ctx.admin
    .from("jobs")
    .select("id,title")
    .eq("id", jobId)
    .eq("company_id", ctx.companyId)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job) throw new Error("Job not found");

  const [appRes, feedbackRes] = await Promise.all([
    ctx.admin
      .from("applications")
      .select("id,job_id,candidate_id,stage,created_at,candidates(name,email),jobs(title,hiring_manager),job_screening_responses(score,status,review_needed_count)")
      .eq("company_id", ctx.companyId)
      .eq("job_id", jobId),
    ctx.admin.from("interview_feedback").select("candidate_id,panelist_average").eq("company_id", ctx.companyId).eq("job_id", jobId).not("panelist_average", "is", null),
  ]);
  if (appRes.error) throw appRes.error;
  if (feedbackRes.error) throw feedbackRes.error;

  const feedbackByCandidate = new Map<string, number[]>();
  for (const feedback of (feedbackRes.data ?? []) as Array<{ candidate_id: string; panelist_average: number }>) {
    const list = feedbackByCandidate.get(feedback.candidate_id) ?? [];
    list.push(Number(feedback.panelist_average));
    feedbackByCandidate.set(feedback.candidate_id, list);
  }

  let rows = ((appRes.data ?? []) as Array<Record<string, unknown>>).map((app) => {
    const candidate = app.candidates as { name?: string | null; email?: string | null } | null | undefined;
    const jobRow = app.jobs as { title?: string | null; hiring_manager?: string | null } | null | undefined;
    const screeningList = Array.isArray(app.job_screening_responses) ? app.job_screening_responses as Array<Record<string, unknown>> : [];
    const screening = screeningList[0] ?? {};
    const feedback = feedbackByCandidate.get(String(app.candidate_id)) ?? [];
    const interviewAverage = feedback.length
      ? Math.round((feedback.reduce((sum, value) => sum + value, 0) / feedback.length) * 10) / 10
      : null;
    return {
      id: app.id,
      job_id: app.job_id,
      candidate_id: app.candidate_id,
      stage: app.stage,
      created_at: app.created_at,
      candidate_name: candidate?.name ?? "",
      candidate_email: candidate?.email ?? "",
      job_title: jobRow?.title ?? "",
      hiring_manager: jobRow?.hiring_manager ?? "",
      screening_score: screening.score ?? null,
      screening_status: screening.status ?? null,
      review_needed_count: screening.review_needed_count ?? 0,
      interview_average: interviewAverage,
    };
  });

  if (scope === "current_view") {
    const search = String(filters.search ?? "").trim().toLowerCase();
    if (search) rows = rows.filter((row) => row.candidate_name.toLowerCase().includes(search) || row.candidate_email.toLowerCase().includes(search));
    const min = filters.screeningMin ? Number(filters.screeningMin) : null;
    const max = filters.screeningMax ? Number(filters.screeningMax) : null;
    if (Number.isFinite(min)) rows = rows.filter((row) => Number(row.screening_score) >= Number(min));
    if (Number.isFinite(max)) rows = rows.filter((row) => Number(row.screening_score) <= Number(max));
    if (filters.screeningStatus && filters.screeningStatus !== "all") rows = rows.filter((row) => row.screening_status === filters.screeningStatus);
  }
  const exportFilename = filename(`${job.title}-pipeline`);
  const summary = filterSummary("pipeline", scope, filters);
  assertUnderHardCap(rows.length, exportFilename, summary);

  const sort = String(filters.sort ?? "screening_desc");
  rows = [...rows].sort((left, right) => {
    if (sort === "name_asc") return left.candidate_name.localeCompare(right.candidate_name);
    if (sort === "oldest") return new Date(String(left.created_at)).getTime() - new Date(String(right.created_at)).getTime();
    if (sort === "interview_desc") return Number(right.interview_average ?? -1) - Number(left.interview_average ?? -1);
    return Number(right.screening_score ?? -1) - Number(left.screening_score ?? -1);
  });

  const headers = ["Application ID", "Candidate Name", "Email", "Job Title", "Hiring Manager", "Stage", "Screening Score", "Screening Status", "Review Needed Count", "Interview Average", "Created At"];
  const sheetRows = [
    headers.map(headerCell),
    ...rows.map((row) => [
      textCell(row.id),
      textCell(row.candidate_name),
      textCell(row.candidate_email),
      textCell(row.job_title),
      textCell(row.hiring_manager),
      textCell(normalizeStatus(row.stage)),
      row.screening_score === null ? textCell("") : numberCell(row.screening_score),
      textCell(normalizeStatus(row.screening_status)),
      numberCell(row.review_needed_count),
      row.interview_average === null ? textCell("") : numberCell(row.interview_average),
      dateCell(row.created_at),
    ]),
  ];

  return {
    rows: sheetRows,
    rowCount: rows.length,
    filename: exportFilename,
    filterSummary: summary,
    columns: headers.map((header) => ({ width: Math.min(Math.max(header.length + 4, 16), 38) })),
  };
}

async function authenticate(req: Request): Promise<AuthContext | Response> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  const [companyRes, adminRes, recruiterRes] = await Promise.all([
    userClient.rpc("get_user_company_id", { _user_id: userId }),
    userClient.rpc("has_role", { _user_id: userId, _role: "admin" }),
    userClient.rpc("has_role", { _user_id: userId, _role: "recruiter" }),
  ]);
  if (companyRes.error || adminRes.error || recruiterRes.error) {
    console.error("request-export auth check failed", companyRes.error ?? adminRes.error ?? recruiterRes.error);
    return json({ error: "Authorization check failed" }, 500);
  }
  if (!companyRes.data || (!adminRes.data && !recruiterRes.data)) return json({ error: "Forbidden" }, 403);

  return {
    userId,
    companyId: companyRes.data,
    admin: createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const R2_WORKER_BASE_URL = Deno.env.get("R2_WORKER_BASE_URL");
  const R2_WORKER_SECRET = Deno.env.get("R2_WORKER_SECRET");
  const R2_EXPORTS_BUCKET = Deno.env.get("R2_EXPORTS_BUCKET") ?? "rizonhire-exports";
  if (!R2_WORKER_BASE_URL || !R2_WORKER_SECRET) return json({ error: "Server misconfigured" }, 500);

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  let jobId: string | null = null;

  try {
    const body = await req.json().catch(() => null) as { export_type?: ExportType; scope?: ExportScope; filters?: Record<string, unknown> } | null;
    if (!body || !["form_submissions", "candidates", "pipeline"].includes(body.export_type ?? "")) {
      return json({ error: "export_type is required" }, 400);
    }
    const scope = body.scope === "full_dataset" ? "full_dataset" : "current_view";
    const filters = body.filters && typeof body.filters === "object" ? body.filters : {};

    const { data: inserted, error: insertError } = await auth.admin
      .from("export_jobs")
      .insert({
        company_id: auth.companyId,
        requested_by: auth.userId,
        export_type: body.export_type,
        scope,
        filters,
        filter_summary: filterSummary(body.export_type, scope, filters),
        status: "running",
      })
      .select("*")
      .single();
    if (insertError) throw insertError;
    jobId = inserted.id;

    const build = body.export_type === "form_submissions"
      ? await buildFormExport(auth, scope, filters)
      : body.export_type === "candidates"
        ? await buildCandidatesExport(auth, scope, filters)
        : await buildPipelineExport(auth, scope, filters);

    const blob = await writeXlsxFile(build.rows as never, {
      sheet: "Data",
      stickyRowsCount: 1,
      columns: build.columns,
    }).toBlob();

    const r2Key = `exports/${auth.companyId}/${jobId}/${build.filename}`;
    const uploadRes = await fetch(`${R2_WORKER_BASE_URL.replace(/\/+$/, "")}/exports/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${R2_WORKER_SECRET}`,
        "Content-Type": XLSX_MIME,
        "x-export-bucket": R2_EXPORTS_BUCKET,
        "x-export-key": r2Key,
      },
      body: blob,
    });
    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => "");
      console.error("export R2 upload failed", uploadRes.status, text);
      throw new Error("Could not upload export file");
    }

    const expiresAt = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: updated, error: updateError } = await auth.admin
      .from("export_jobs")
      .update({
        status: "completed",
        row_count: build.rowCount,
        r2_bucket: R2_EXPORTS_BUCKET,
        r2_key: r2Key,
        filename: build.filename,
        expires_at: expiresAt,
        filter_summary: build.filterSummary,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select("*")
      .single();
    if (updateError) throw updateError;

    const warning = build.rowCount > WARN_ROW_COUNT
      ? `This export contains ${build.rowCount.toLocaleString()} rows and may take a moment to download.`
      : null;

    return json({ success: true, job: updated, warning });
  } catch (err) {
    console.error("request-export fatal", err);
    if (jobId) {
      await auth.admin.from("export_jobs").update({
        status: "failed",
        row_count: err instanceof RowCapExceeded ? err.rowCount : undefined,
        filename: err instanceof RowCapExceeded ? err.filename : undefined,
        filter_summary: err instanceof RowCapExceeded ? err.filterSummary : undefined,
        error_message: err instanceof Error ? err.message : "Export failed",
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);
    }
    return json(
      { error: err instanceof Error ? err.message : "Internal server error", job_id: jobId },
      err instanceof RowCapExceeded ? 422 : 500,
    );
  }
});
