import { LeadFormField, LeadFormSchema, LeadFormSubmission, answerPreview } from "@/lib/leadForms";

export type SubmissionColumnType = "answer" | "status" | "submitted" | "actions";
export type SubmissionSortDirection = "asc" | "desc";
export type SubmissionFilterOperator = "contains" | "equals" | "is_empty" | "is_not_empty" | "before" | "after";

export interface SubmissionTableColumn {
  id: string;
  label: string;
  type: SubmissionColumnType;
  field?: LeadFormField;
}

export interface SubmissionSortState {
  columnId: string;
  direction: SubmissionSortDirection;
}

export interface SubmissionTableFilter {
  id: string;
  columnId: string;
  operator: SubmissionFilterOperator;
  value: string;
}

export interface PaginationResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

export const SYSTEM_SUBMISSION_COLUMNS: SubmissionTableColumn[] = [
  { id: "status", label: "Status", type: "status" },
  { id: "submitted", label: "Submitted", type: "submitted" },
  { id: "actions", label: "Actions", type: "actions" },
];

export function answerColumnId(fieldId: string) {
  return `field:${fieldId}`;
}

export function createSubmissionColumns(schema: LeadFormSchema) {
  const answerColumns = schema.fields
    .filter((field) => field.type !== "section")
    .map((field) => ({
      id: answerColumnId(field.id),
      label: field.label,
      type: "answer" as const,
      field,
    }));

  return [...answerColumns, ...SYSTEM_SUBMISSION_COLUMNS];
}

export function defaultVisibleAnswerColumnIds(schema: LeadFormSchema) {
  return schema.fields.filter((field) => field.type !== "section").map((field) => answerColumnId(field.id));
}

export function getSubmissionColumnValue(submission: LeadFormSubmission, column: SubmissionTableColumn) {
  if (column.type === "status") return submission.status;
  if (column.type === "submitted") return submission.created_at;
  if (column.type === "answer" && column.field) return submission.answers[column.field.id];
  return "";
}

export function isEmptySubmissionValue(value: unknown) {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === "object" && "fileName" in value) {
    return !String((value as { fileName?: string }).fileName ?? "").trim();
  }
  return value === null || value === undefined || String(value).trim() === "";
}

export function submissionValueText(value: unknown) {
  if (isEmptySubmissionValue(value)) return "";
  return answerPreview(value);
}

function compareValues(left: unknown, right: unknown, column: SubmissionTableColumn) {
  if (column.type === "submitted") {
    return new Date(String(left)).getTime() - new Date(String(right)).getTime();
  }

  const leftText = submissionValueText(left).toLocaleLowerCase();
  const rightText = submissionValueText(right).toLocaleLowerCase();
  return leftText.localeCompare(rightText, undefined, { numeric: true, sensitivity: "base" });
}

export function applySubmissionSort(
  submissions: LeadFormSubmission[],
  columns: SubmissionTableColumn[],
  sort: SubmissionSortState | null,
) {
  if (!sort) return submissions;
  const column = columns.find((item) => item.id === sort.columnId);
  if (!column || column.type === "actions") return submissions;

  return [...submissions].sort((left, right) => {
    const comparison = compareValues(
      getSubmissionColumnValue(left, column),
      getSubmissionColumnValue(right, column),
      column,
    );
    return sort.direction === "asc" ? comparison : -comparison;
  });
}

function matchesFilter(value: unknown, column: SubmissionTableColumn, filter: SubmissionTableFilter) {
  const empty = isEmptySubmissionValue(value);
  if (filter.operator === "is_empty") return empty;
  if (filter.operator === "is_not_empty") return !empty;
  if (empty) return false;

  const filterValue = filter.value.trim();
  if (!filterValue) return true;

  if (column.type === "submitted" && (filter.operator === "before" || filter.operator === "after")) {
    const valueTime = new Date(String(value)).getTime();
    const filterTime = new Date(filterValue).getTime();
    if (!Number.isFinite(valueTime) || !Number.isFinite(filterTime)) return false;
    return filter.operator === "before" ? valueTime < filterTime : valueTime > filterTime;
  }

  const valueText = submissionValueText(value).toLocaleLowerCase();
  const normalizedFilter = filterValue.toLocaleLowerCase();
  if (filter.operator === "equals") return valueText === normalizedFilter;
  return valueText.includes(normalizedFilter);
}

export function applySubmissionFilters(
  submissions: LeadFormSubmission[],
  columns: SubmissionTableColumn[],
  filters: SubmissionTableFilter[],
) {
  const activeFilters = filters.filter((filter) => filter.columnId && filter.operator);
  if (activeFilters.length === 0) return submissions;

  return submissions.filter((submission) =>
    activeFilters.every((filter) => {
      const column = columns.find((item) => item.id === filter.columnId);
      if (!column || column.type === "actions") return true;
      return matchesFilter(getSubmissionColumnValue(submission, column), column, filter);
    }),
  );
}

export function paginateSubmissions<T>(items: T[], page: number, pageSize: number): PaginationResult<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = items.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(items.length, safePage * pageSize);

  return {
    items: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    page: safePage,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
  };
}
