import type { TimelineEvent } from "@/components/candidate/ActivityTimeline";

export type PipelineStage =
  | "applied"
  | "shortlisted"
  | "screening"
  | "scheduling"
  | "1st_interview"
  | "2nd_interview"
  | "offer"
  | "hired"
  | "rejected";

export interface PipelineApplication {
  id: string;
  job_id: string;
  candidate_id: string;
  stage: PipelineStage;
  company_id: string;
  candidate: { name: string; email: string | null };
  job: { title: string; hiring_manager: string | null; status: string | null };
}

export interface PipelineApplicationRow {
  id: string;
  job_id: string;
  candidate_id: string;
  stage: PipelineStage;
  company_id: string;
  candidates: { name: string; email: string | null } | null;
  jobs: { title: string | null; hiring_manager: string | null; status: string | null } | null;
}

export function mapActivePipelineApplications(rows: PipelineApplicationRow[]): PipelineApplication[] {
  return rows
    .filter((row) => row.jobs?.status === "open")
    .map((row) => ({
      id: row.id,
      job_id: row.job_id,
      candidate_id: row.candidate_id,
      stage: row.stage,
      company_id: row.company_id,
      candidate: row.candidates ?? { name: "Unknown candidate", email: null },
      job: {
        title: row.jobs?.title ?? "Untitled job",
        hiring_manager: row.jobs?.hiring_manager ?? null,
        status: row.jobs?.status ?? null,
      },
    }));
}

export function reconcilePipelineSelection<T extends { id: string }>(
  applications: T[],
  selectedIds: string[],
  selectedApp: T | null,
) {
  const visibleIds = new Set(applications.map((app) => app.id));
  return {
    selectedIds: selectedIds.filter((id) => visibleIds.has(id)),
    selectedApp: selectedApp && visibleIds.has(selectedApp.id)
      ? applications.find((app) => app.id === selectedApp.id) ?? selectedApp
      : null,
  };
}

export function buildPipelineCandidateTimeline(args: {
  candidateId: string;
  candidateCreatedAt?: string | null;
  applications: Array<{ id: string; job_title: string; stage: string; created_at: string }>;
  notes: Array<{ id: string; content: string; created_at: string }>;
  emailLogs: Array<{ id: string; template_key: string; context: Record<string, unknown> | null; created_at: string }>;
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (args.candidateCreatedAt) {
    events.push({
      id: `created-${args.candidateId}`,
      type: "created",
      title: "Candidate profile created",
      timestamp: args.candidateCreatedAt,
    });
  }

  args.applications.forEach((app) => {
    events.push({
      id: `app-${app.id}`,
      type: "applied",
      title: `Applied for ${app.job_title}`,
      description: `Current stage: ${app.stage.replace(/_/g, " ")}`,
      timestamp: app.created_at,
    });
  });

  args.notes.forEach((note) => {
    events.push({
      id: `note-${note.id}`,
      type: "note",
      title: "Note added",
      description: note.content.length > 120 ? `${note.content.slice(0, 120)}...` : note.content,
      timestamp: note.created_at,
    });
  });

  args.emailLogs.forEach((email) => {
    const subject = typeof email.context?.subject === "string" ? email.context.subject : "Candidate email";
    const templateName = typeof email.context?.template_name === "string" ? email.context.template_name : email.template_key;
    events.push({
      id: `email-${email.id}`,
      type: "email",
      title: "Email sent",
      description: subject,
      timestamp: email.created_at,
      meta: templateName,
    });
  });

  return events.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
}
