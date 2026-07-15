import { describe, expect, it } from "vitest";
import {
  buildSafeExportFilename,
  ensureExportAllowed,
  normalizeFullDatasetFilters,
  shouldWarnForRowCount,
} from "./exportJobs";

describe("export job helpers", () => {
  it("builds safe xlsx filenames", () => {
    expect(buildSafeExportFilename("Candidates: July/PII", new Date("2026-07-15T10:00:00.000Z"))).toBe(
      "candidates-july-pii-2026-07-15.xlsx",
    );
  });

  it("normalizes full-dataset filters while retaining required context", () => {
    expect(
      normalizeFullDatasetFilters("form_submissions", {
        formId: "form_1",
        filters: [{ id: "f1", columnId: "status", operator: "equals", value: "new" }],
      }),
    ).toEqual({ formId: "form_1" });
    expect(
      normalizeFullDatasetFilters("pipeline", {
        jobId: "job_1",
        search: "ava",
        sort: "name_asc",
      }),
    ).toEqual({ jobId: "job_1", sort: "name_asc" });
    expect(normalizeFullDatasetFilters("candidates", { search: "ava", repeatOnly: true })).toEqual({});
  });

  it("enforces warning and hard-cap row policies", () => {
    expect(shouldWarnForRowCount(5000)).toBe(false);
    expect(shouldWarnForRowCount(5001)).toBe(true);
    expect(shouldWarnForRowCount(25001)).toBe(false);
    expect(() => ensureExportAllowed(25001)).toThrow(/25,000/);
    expect(() => ensureExportAllowed(25000)).not.toThrow();
  });
});
