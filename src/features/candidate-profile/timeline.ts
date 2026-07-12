import type { TimelineEvent } from "@/components/candidate/ActivityTimeline";
import type { ApplicationWithJob, Candidate, EmailLog } from "./types";
import type { NoteWithAuthor } from "@/components/candidate/CandidateNotes";

export function buildCandidateTimeline(
  candidate: Candidate | null,
  applications: ApplicationWithJob[],
  notes: NoteWithAuthor[],
  emailLogs: EmailLog[],
): TimelineEvent[] {
  if (!candidate) return [];
  const events: TimelineEvent[] = [];

  events.push({
    id: "created-" + candidate.id,
    type: "created",
    title: "Candidate profile created",
    timestamp: candidate.created_at,
  });

  if (candidate.resume_url) {
    events.push({
      id: "resume-" + candidate.id,
      type: "resume",
      title: "Resume uploaded",
      timestamp: candidate.created_at,
    });
  }

  applications.forEach((app) => {
    events.push({
      id: "app-" + app.id,
      type: "applied",
      title: `Applied for ${app.job_title}`,
      description: `Current stage: ${app.stage}`,
      timestamp: app.created_at,
    });
  });

  notes.forEach((n) => {
    events.push({
      id: "note-" + n.id,
      type: "note",
      title: "Note added",
      description: n.content.length > 120 ? n.content.slice(0, 120) + "…" : n.content,
      timestamp: n.created_at,
      meta: n.author_name,
    });
  });

  emailLogs.forEach((email) => {
    const context = email.context ?? {};
    const subject = typeof context.subject === "string" ? context.subject : "Candidate email";
    const templateName = typeof context.template_name === "string" ? context.template_name : email.template_key;
    events.push({
      id: "email-" + email.id,
      type: "email",
      title: "Email sent",
      description: subject,
      timestamp: email.created_at,
      meta: templateName,
    });
  });

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events;
}
