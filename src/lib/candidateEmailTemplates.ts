import {
  DEFAULT_REJECTION_EMAIL_HTML,
  DEFAULT_REJECTION_EMAIL_SUBJECT,
  DEFAULT_REJECTION_EMAIL_TEXT,
  DEFAULT_REJECTION_TEMPLATE_NAME,
  REJECTION_TEMPLATE_KEY,
} from "@/lib/rejectionEmailTemplate";

export const CANDIDATE_EMAIL_PURPOSES = ["general", "form_link", "video_screening", "rejection"] as const;

export type CandidateEmailTemplatePurpose = typeof CANDIDATE_EMAIL_PURPOSES[number];

export const CANDIDATE_EMAIL_PURPOSE_LABELS: Record<CandidateEmailTemplatePurpose, string> = {
  general: "General",
  form_link: "Form Link",
  video_screening: "Video Screening",
  rejection: "Rejection",
};

export const CANDIDATE_EMAIL_VARIABLES = ["candidate_name", "company_name", "job_title"] as const;
export const FORM_LINK_EMAIL_VARIABLES = [...CANDIDATE_EMAIL_VARIABLES, "form_link"] as const;
export const VIDEO_SCREENING_EMAIL_VARIABLES = [...CANDIDATE_EMAIL_VARIABLES, "screening_link"] as const;

export type CandidateEmailVariable = typeof CANDIDATE_EMAIL_VARIABLES[number];

export interface CandidateEmailTemplate {
  id?: string;
  company_id: string;
  key: string;
  name: string;
  purpose: CandidateEmailTemplatePurpose;
  is_default_for_purpose: boolean;
  subject: string;
  html_body: string;
  text_body: string | null;
  variables: string[];
  is_active: boolean;
  archived_at: string | null;
  updated_at?: string;
  updated_by?: string | null;
}

export const SAMPLE_CANDIDATE_EMAIL_VARIABLES: Record<CandidateEmailVariable, string> = {
  candidate_name: "Jordan Lee",
  company_name: "Acme Hiring",
  job_title: "Customer Success Manager",
};

export const SAMPLE_LINK_EMAIL_VARIABLES = {
  form_link: "https://app.rizonhire.com/forms/lf_sample",
  screening_link: "https://app.rizonhire.com/screen/screening_sample",
};

export function normalizeCandidateEmailPurpose(value: unknown): CandidateEmailTemplatePurpose {
  return CANDIDATE_EMAIL_PURPOSES.includes(value as CandidateEmailTemplatePurpose)
    ? (value as CandidateEmailTemplatePurpose)
    : "general";
}

export function variablesForCandidateEmailPurpose(purpose: CandidateEmailTemplatePurpose) {
  if (purpose === "form_link") return [...FORM_LINK_EMAIL_VARIABLES];
  if (purpose === "video_screening") return [...VIDEO_SCREENING_EMAIL_VARIABLES];
  return [...CANDIDATE_EMAIL_VARIABLES];
}

export function requiredTokenForCandidateEmailPurpose(purpose: CandidateEmailTemplatePurpose) {
  if (purpose === "form_link") return "{{form_link}}";
  if (purpose === "video_screening") return "{{screening_link}}";
  return null;
}

export function candidateEmailTemplateHasRequiredToken(template: Pick<CandidateEmailTemplate, "purpose" | "subject" | "html_body">) {
  const token = requiredTokenForCandidateEmailPurpose(template.purpose);
  if (!token) return true;
  const combined = `${template.subject}\n${template.html_body}`;
  const tokenName = token.replace(/[{}]/g, "");
  return new RegExp(`\\{\\{\\s*${tokenName}\\s*\\}\\}`).test(combined);
}

export function renderCandidateEmailTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

export function candidateEmailVariableToken(variable: string) {
  return `{{${variable}}}`;
}

export function appendCandidateEmailTokenToHtml(html: string, token: string) {
  const trimmed = html.trim();
  if (!trimmed || trimmed === "<p><br></p>") return `<p>${token}</p>`;
  return `${trimmed}<p>${token}</p>`;
}

export function insertCandidateEmailTokenInText(value: string, token: string, start?: number | null, end?: number | null) {
  if (typeof start !== "number" || typeof end !== "number") {
    return `${value}${value.endsWith(" ") || value.length === 0 ? "" : " "}${token}`;
  }
  return `${value.slice(0, start)}${token}${value.slice(end)}`;
}

export function normalizeCandidateEmailTemplate(row: Partial<CandidateEmailTemplate>): CandidateEmailTemplate {
  const purpose = normalizeCandidateEmailPurpose(row.purpose);
  return {
    company_id: row.company_id ?? "",
    key: row.key ?? makeCandidateEmailTemplateKey(),
    name: row.name?.trim() || "Untitled template",
    purpose,
    is_default_for_purpose: row.is_default_for_purpose ?? false,
    subject: row.subject ?? "",
    html_body: row.html_body ?? "",
    text_body: row.text_body ?? null,
    variables: Array.isArray(row.variables) ? row.variables : variablesForCandidateEmailPurpose(purpose),
    is_active: row.is_active ?? true,
    archived_at: row.archived_at ?? null,
    id: row.id,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
}

export function defaultCandidateEmailTemplate(companyId: string, purpose: CandidateEmailTemplatePurpose = "general"): CandidateEmailTemplate {
  const requiredToken = requiredTokenForCandidateEmailPurpose(purpose);
  const linkParagraph = requiredToken ? `<p>${requiredToken}</p>` : "";

  return {
    company_id: companyId,
    key: makeCandidateEmailTemplateKey(),
    name: purpose === "general" ? "New Candidate Email" : `New ${CANDIDATE_EMAIL_PURPOSE_LABELS[purpose]} Email`,
    purpose,
    is_default_for_purpose: false,
    subject: "Update from {{company_name}}",
    html_body: `<p>Hi {{candidate_name}},</p><p></p>${linkParagraph}<p>Kind regards,<br/>The {{company_name}} Hiring Team</p>`,
    text_body: null,
    variables: variablesForCandidateEmailPurpose(purpose),
    is_active: true,
    archived_at: null,
  };
}

export function defaultRejectionCandidateEmailTemplate(companyId: string): CandidateEmailTemplate {
  return {
    company_id: companyId,
    key: REJECTION_TEMPLATE_KEY,
    name: DEFAULT_REJECTION_TEMPLATE_NAME,
    purpose: "rejection",
    is_default_for_purpose: true,
    subject: DEFAULT_REJECTION_EMAIL_SUBJECT,
    html_body: DEFAULT_REJECTION_EMAIL_HTML,
    text_body: DEFAULT_REJECTION_EMAIL_TEXT,
    variables: [...CANDIDATE_EMAIL_VARIABLES],
    is_active: true,
    archived_at: null,
  };
}

export function makeCandidateEmailTemplateKey() {
  return `candidate_email_${crypto.randomUUID()}`;
}

export { REJECTION_TEMPLATE_KEY };
