export const REJECTION_TEMPLATE_KEY = "candidate_rejected";

export const REJECTION_TEMPLATE_VARIABLES = ["candidate_name", "company_name", "job_title"] as const;

export type RejectionTemplateVariable = typeof REJECTION_TEMPLATE_VARIABLES[number];

export const DEFAULT_REJECTION_EMAIL_SUBJECT = "Update on your application for {{job_title}}";

export const DEFAULT_REJECTION_EMAIL_HTML = [
  "<p>Hi {{candidate_name}},</p>",
  "<p>Thank you for your interest in the <strong>{{job_title}}</strong> role at <strong>{{company_name}}</strong> and for taking the time to share your background with us.</p>",
  "<p>After reviewing your application, we have decided to move forward with other candidates whose experience more closely matches our current needs.</p>",
  "<p>We appreciate your interest in {{company_name}} and wish you all the best in your job search.</p>",
  "<p>Kind regards,<br/>The {{company_name}} Hiring Team</p>",
].join("");

export const DEFAULT_REJECTION_EMAIL_TEXT = `Hi {{candidate_name}},

Thank you for your interest in the {{job_title}} role at {{company_name}} and for taking the time to share your background with us.

After reviewing your application, we have decided to move forward with other candidates whose experience more closely matches our current needs.

We appreciate your interest in {{company_name}} and wish you all the best in your job search.

Kind regards,
The {{company_name}} Hiring Team`;

export const DEFAULT_REJECTION_TEMPLATE_NAME = "Candidate Rejected";

export const SAMPLE_REJECTION_VARIABLES: Record<RejectionTemplateVariable, string> = {
  candidate_name: "Jordan Lee",
  company_name: "Acme Hiring",
  job_title: "Customer Success Manager",
};

export function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

export function variableToken(variable: string) {
  return `{{${variable}}}`;
}

export function appendTokenToHtml(html: string, token: string) {
  const trimmed = html.trim();
  if (!trimmed || trimmed === "<p><br></p>") return `<p>${token}</p>`;
  return `${trimmed}<p>${token}</p>`;
}

export function insertTokenInText(value: string, token: string, start?: number | null, end?: number | null) {
  if (typeof start !== "number" || typeof end !== "number") {
    return `${value}${value.endsWith(" ") || value.length === 0 ? "" : " "}${token}`;
  }
  return `${value.slice(0, start)}${token}${value.slice(end)}`;
}
