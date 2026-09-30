import { describe, expect, it } from "vitest";

import {
  EMPLOYMENT_TYPE_OPTIONS,
  MAX_JOB_LOCATION_LENGTH,
  getEmploymentTypeLabel,
  getJobMetadataDisplayValue,
  normalizeJobMetadata,
  validateJobMetadata,
} from "./jobMetadata";

describe("job metadata", () => {
  it("exposes the four supported employment types", () => {
    expect(EMPLOYMENT_TYPE_OPTIONS).toEqual([
      { value: "permanent", label: "Permanent" },
      { value: "temporary", label: "Temporary" },
      { value: "contract", label: "Contract" },
      { value: "seasonal", label: "Seasonal" },
    ]);
  });

  it("normalizes location and employment type before persistence", () => {
    expect(normalizeJobMetadata({ location: "  Kingston  ", employmentType: "  contract " })).toEqual({
      location: "Kingston",
      employmentType: "contract",
    });
  });

  it("rejects missing metadata and locations over the maximum length", () => {
    expect(validateJobMetadata({ location: "   ", employmentType: "" })).toEqual({
      location: "Location is required.",
      employmentType: "Employment type is required.",
    });

    expect(validateJobMetadata({ location: "x".repeat(MAX_JOB_LOCATION_LENGTH + 1), employmentType: "permanent" })).toEqual({
      location: `Location must be ${MAX_JOB_LOCATION_LENGTH} characters or fewer.`,
    });
  });

  it("formats known values and safely preserves unknown stored values", () => {
    expect(getEmploymentTypeLabel("seasonal")).toBe("Seasonal");
    expect(getEmploymentTypeLabel(" future_type ")).toBe("future_type");
    expect(getJobMetadataDisplayValue(null)).toBe("Not specified");
    expect(getJobMetadataDisplayValue("  ")).toBe("Not specified");
    expect(getJobMetadataDisplayValue("Remote")).toBe("Remote");
  });
});
