import { describe, expect, it } from "vitest";
import { LeadFormSchema, LeadFormSubmission } from "./leadForms";
import {
  applySubmissionFilters,
  applySubmissionSort,
  answerColumnId,
  createSubmissionColumns,
  defaultVisibleAnswerColumnIds,
  paginateSubmissions,
} from "./leadFormSubmissionsTable";

const schema: LeadFormSchema = {
  fields: [
    { id: "name", type: "text", label: "Name" },
    { id: "email", type: "email", label: "Email" },
    { id: "resume", type: "file", label: "Resume" },
    { id: "intro", type: "section", label: "Intro" },
  ],
};

const submissions: LeadFormSubmission[] = [
  {
    id: "sub_1",
    form_id: "form_1",
    company_id: "company_1",
    status: "new",
    created_at: "2026-07-01T10:00:00.000Z",
    schema_snapshot: schema,
    answers: { name: "Ava", email: "ava@example.com", resume: { fileName: "ava.pdf" } },
  },
  {
    id: "sub_2",
    form_id: "form_1",
    company_id: "company_1",
    status: "reviewed",
    created_at: "2026-07-03T10:00:00.000Z",
    schema_snapshot: schema,
    answers: { name: "Ben", email: "ben@work.com", resume: null },
  },
  {
    id: "sub_3",
    form_id: "form_1",
    company_id: "company_1",
    status: "new",
    created_at: "2026-07-02T10:00:00.000Z",
    schema_snapshot: schema,
    answers: { name: "Cara", email: "cara@example.com", resume: { fileName: "cara.pdf" } },
  },
];

describe("lead form submissions table helpers", () => {
  it("creates dynamic answer columns from non-section fields", () => {
    const columns = createSubmissionColumns(schema);

    expect(columns.map((column) => column.id)).toEqual([
      "field:name",
      "field:email",
      "field:resume",
      "status",
      "submitted",
      "actions",
    ]);
    expect(defaultVisibleAnswerColumnIds(schema)).toEqual(["field:name", "field:email", "field:resume"]);
  });

  it("sorts answer and system columns", () => {
    const columns = createSubmissionColumns(schema);

    expect(applySubmissionSort(submissions, columns, { columnId: answerColumnId("name"), direction: "desc" }).map((item) => item.id)).toEqual([
      "sub_3",
      "sub_2",
      "sub_1",
    ]);
    expect(applySubmissionSort(submissions, columns, { columnId: "submitted", direction: "asc" }).map((item) => item.id)).toEqual([
      "sub_1",
      "sub_3",
      "sub_2",
    ]);
  });

  it("applies stacked AND filters", () => {
    const columns = createSubmissionColumns(schema);
    const filtered = applySubmissionFilters(submissions, columns, [
      { id: "one", columnId: "status", operator: "equals", value: "new" },
      { id: "two", columnId: answerColumnId("email"), operator: "contains", value: "example.com" },
    ]);

    expect(filtered.map((item) => item.id)).toEqual(["sub_1", "sub_3"]);
  });

  it("supports empty and not empty filters", () => {
    const columns = createSubmissionColumns(schema);

    expect(
      applySubmissionFilters(submissions, columns, [
        { id: "empty", columnId: answerColumnId("resume"), operator: "is_empty", value: "" },
      ]).map((item) => item.id),
    ).toEqual(["sub_2"]);
    expect(
      applySubmissionFilters(submissions, columns, [
        { id: "filled", columnId: answerColumnId("resume"), operator: "is_not_empty", value: "" },
      ]).map((item) => item.id),
    ).toEqual(["sub_1", "sub_3"]);
  });

  it("supports submitted before and after filters", () => {
    const columns = createSubmissionColumns(schema);

    expect(
      applySubmissionFilters(submissions, columns, [
        { id: "before", columnId: "submitted", operator: "before", value: "2026-07-02T12:00:00.000Z" },
      ]).map((item) => item.id),
    ).toEqual(["sub_1", "sub_3"]);
    expect(
      applySubmissionFilters(submissions, columns, [
        { id: "after", columnId: "submitted", operator: "after", value: "2026-07-02T12:00:00.000Z" },
      ]).map((item) => item.id),
    ).toEqual(["sub_2"]);
  });

  it("paginates after filtering and sorting", () => {
    const columns = createSubmissionColumns(schema);
    const sorted = applySubmissionSort(submissions, columns, { columnId: "submitted", direction: "asc" });
    const page = paginateSubmissions(sorted, 2, 2);

    expect(page.items.map((item) => item.id)).toEqual(["sub_2"]);
    expect(page.page).toBe(2);
    expect(page.totalPages).toBe(2);
    expect(page.startIndex).toBe(3);
    expect(page.endIndex).toBe(3);
  });
});
