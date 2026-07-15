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
import {
  buildFormSubmissionsFileName,
  buildFormSubmissionsSheetData,
  escapeSpreadsheetFormula,
} from "./leadFormSubmissionsExport";

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

describe("lead form submissions export helpers", () => {
  const exportSchema: LeadFormSchema = {
    fields: [
      { id: "name", type: "text", label: "Name" },
      { id: "score", type: "number", label: "Score" },
      { id: "available", type: "checkbox", label: "Available" },
      { id: "skills", type: "multi_select", label: "Skills" },
      { id: "resume", type: "file", label: "Resume" },
      { id: "legacy", type: "section", label: "Legacy section" },
    ],
  };

  const exportForm = {
    id: "form_1",
    company_id: "company_1",
    created_by: "user_1",
    title: "QA Intake Form!",
    description: null,
    status: "active" as const,
    public_id: "public_1",
    schema: exportSchema,
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-01T10:00:00.000Z",
    deleted_at: null,
  };

  function cellValue(rowIndex: number, columnIndex: number) {
    const cell = buildFormSubmissionsSheetData(exportForm, [
      {
        id: "sub_1",
        form_id: "form_1",
        company_id: "company_1",
        status: "new",
        created_at: "2026-07-01T10:00:00.000Z",
        schema_snapshot: exportSchema,
        answers: {
          name: "=SUM(1,1)",
          score: "42",
          available: true,
          skills: ["Excel", "Hiring"],
          resume: { fileName: "ava.pdf" },
        },
      },
      {
        id: "sub_2",
        form_id: "form_1",
        company_id: "company_1",
        status: "reviewed",
        created_at: "2026-07-02T10:00:00.000Z",
        schema_snapshot: exportSchema,
        answers: {
          name: "",
          score: null,
          available: false,
          skills: [],
          resume: null,
        },
      },
    ])[rowIndex][columnIndex];

    return cell && typeof cell === "object" && "value" in cell ? cell.value : cell;
  }

  it("builds export rows from current non-section fields", () => {
    expect(cellValue(0, 0)).toBe("Submission ID");
    expect(cellValue(0, 1)).toBe("Status");
    expect(cellValue(0, 2)).toBe("Submitted At");
    expect(cellValue(0, 3)).toBe("Name");
    expect(cellValue(0, 4)).toBe("Score");
    expect(cellValue(0, 5)).toBe("Available");
    expect(cellValue(0, 6)).toBe("Skills");
    expect(cellValue(0, 7)).toBe("Resume");
    expect(cellValue(0, 8)).toBeUndefined();
  });

  it("normalizes answer values for Excel export", () => {
    expect(cellValue(1, 1)).toBe("New");
    expect(cellValue(1, 2)).toEqual(new Date("2026-07-01T10:00:00.000Z"));
    expect(cellValue(1, 3)).toBe("'=SUM(1,1)");
    expect(cellValue(1, 4)).toBe(42);
    expect(cellValue(1, 5)).toBe("Yes");
    expect(cellValue(1, 6)).toBe("Excel, Hiring");
    expect(cellValue(1, 7)).toBe("ava.pdf");
    expect(cellValue(2, 1)).toBe("Reviewed");
    expect(cellValue(2, 3)).toBe("");
    expect(cellValue(2, 4)).toBe("");
    expect(cellValue(2, 5)).toBe("No");
    expect(cellValue(2, 6)).toBe("");
    expect(cellValue(2, 7)).toBe("");
  });

  it("escapes strings that could be interpreted as spreadsheet formulas", () => {
    expect(escapeSpreadsheetFormula("=1+1")).toBe("'=1+1");
    expect(escapeSpreadsheetFormula("+1+1")).toBe("'+1+1");
    expect(escapeSpreadsheetFormula("-1+1")).toBe("'-1+1");
    expect(escapeSpreadsheetFormula("@SUM(1,1)")).toBe("'@SUM(1,1)");
    expect(escapeSpreadsheetFormula("  =1+1")).toBe("'  =1+1");
    expect(escapeSpreadsheetFormula("Ava")).toBe("Ava");
  });

  it("builds safe dated file names", () => {
    expect(buildFormSubmissionsFileName(exportForm.title, new Date("2026-07-14T12:00:00.000Z"))).toBe(
      "qa-intake-form-submissions-2026-07-14.xlsx",
    );
  });
});
