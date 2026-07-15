import type { SheetData, SheetOptions } from "write-excel-file/browser";
import type { LeadForm, LeadFormField, LeadFormSchema, LeadFormSubmission } from "@/lib/leadForms";
import { answerPreview } from "@/lib/leadForms";
import { isEmptySubmissionValue } from "@/lib/leadFormSubmissionsTable";

export const LARGE_EXPORT_SUBMISSION_THRESHOLD = 5000;

const FORMULA_PREFIX_PATTERN = /^[=+\-@]/;
const FILE_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function currentAnswerFields(schema: LeadFormSchema) {
  return schema.fields.filter((field) => field.type !== "section");
}

export function escapeSpreadsheetFormula(value: string) {
  return FORMULA_PREFIX_PATTERN.test(value.trimStart()) ? `'${value}` : value;
}

function safeTextCell(value: string) {
  return {
    type: String,
    value: escapeSpreadsheetFormula(value),
  };
}

function dateOrTextCell(value: string) {
  const parsed = new Date(value);
  if (Number.isFinite(parsed.getTime())) {
    return {
      type: Date,
      value: parsed,
      format: "mmm d, yyyy h:mm AM/PM",
    };
  }

  return safeTextCell(value);
}

function normalizeSubmissionStatus(status: LeadFormSubmission["status"]) {
  return status === "reviewed" ? "Reviewed" : "New";
}

function answerToCellValue(field: LeadFormField, value: unknown) {
  if (isEmptySubmissionValue(value)) return "";
  if (field.type === "number" && typeof value !== "boolean" && !Array.isArray(value)) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) return numberValue;
  }
  if (typeof value === "number") return value;
  return escapeSpreadsheetFormula(answerPreview(value));
}

function answerCell(field: LeadFormField, value: unknown) {
  const normalized = answerToCellValue(field, value);
  if (typeof normalized === "number") {
    return {
      type: Number,
      value: normalized,
    };
  }
  return safeTextCell(normalized);
}

function headerCell(label: string) {
  return {
    ...safeTextCell(label),
    fontWeight: "bold" as const,
  };
}

export function buildFormSubmissionsSheetData(form: LeadForm, submissions: LeadFormSubmission[]): SheetData {
  const fields = currentAnswerFields(form.schema);
  const header = [
    "Submission ID",
    "Status",
    "Submitted At",
    ...fields.map((field) => field.label),
  ].map(headerCell);

  return [
    header,
    ...submissions.map((submission) => [
      safeTextCell(submission.id),
      safeTextCell(normalizeSubmissionStatus(submission.status)),
      dateOrTextCell(submission.created_at),
      ...fields.map((field) => answerCell(field, submission.answers[field.id])),
    ]),
  ];
}

export function buildFormSubmissionsSheetOptions(form: LeadForm): SheetOptions<Blob> {
  const fields = currentAnswerFields(form.schema);
  return {
    sheet: "Submissions",
    stickyRowsCount: 1,
    columns: [
      { width: 38 },
      { width: 14 },
      { width: 24 },
      ...fields.map((field) => ({ width: Math.min(Math.max(field.label.length + 4, 16), 42) })),
    ],
  };
}

function dateForFileName(date: Date) {
  const parts = FILE_DATE_PARTS_FORMATTER.formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function buildFormSubmissionsFileName(formTitle: string, date = new Date()) {
  const slug = formTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "form";

  return `${slug}-submissions-${dateForFileName(date)}.xlsx`;
}

export async function downloadFormSubmissionsXlsx(form: LeadForm, submissions: LeadFormSubmission[]) {
  const [{ default: writeXlsxFile }] = await Promise.all([
    import("write-excel-file/browser"),
  ]);

  return writeXlsxFile(
    buildFormSubmissionsSheetData(form, submissions),
    buildFormSubmissionsSheetOptions(form),
  ).toFile(buildFormSubmissionsFileName(form.title));
}
