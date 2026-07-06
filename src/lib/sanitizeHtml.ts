import DOMPurify from "dompurify";

export function sanitizeRichHtml(html?: string | null): string {
  return DOMPurify.sanitize(html ?? "", { USE_PROFILES: { html: true } });
}
