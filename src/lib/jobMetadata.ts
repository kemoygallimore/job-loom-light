export const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "permanent", label: "Permanent" },
  { value: "temporary", label: "Temporary" },
  { value: "contract", label: "Contract" },
  { value: "seasonal", label: "Seasonal" },
] as const;

export type JobEmploymentType = (typeof EMPLOYMENT_TYPE_OPTIONS)[number]["value"];

export const MAX_JOB_LOCATION_LENGTH = 200;
export const UNSPECIFIED_JOB_METADATA = "Not specified";

export interface JobMetadataInput {
  location: string;
  employmentType: string;
}

export type JobMetadataErrors = Partial<Record<keyof JobMetadataInput, string>>;

export function normalizeJobMetadata(input: JobMetadataInput): JobMetadataInput {
  return {
    location: input.location.trim(),
    employmentType: input.employmentType.trim(),
  };
}

export function validateJobMetadata(input: JobMetadataInput): JobMetadataErrors {
  const normalized = normalizeJobMetadata(input);
  const errors: JobMetadataErrors = {};

  if (!normalized.location) {
    errors.location = "Location is required.";
  } else if (normalized.location.length > MAX_JOB_LOCATION_LENGTH) {
    errors.location = `Location must be ${MAX_JOB_LOCATION_LENGTH} characters or fewer.`;
  }

  if (!normalized.employmentType) {
    errors.employmentType = "Employment type is required.";
  }

  return errors;
}

export function getEmploymentTypeLabel(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized) return UNSPECIFIED_JOB_METADATA;
  return EMPLOYMENT_TYPE_OPTIONS.find((option) => option.value === normalized)?.label ?? normalized;
}

export function getJobMetadataDisplayValue(value: string | null | undefined): string {
  return value?.trim() || UNSPECIFIED_JOB_METADATA;
}
