export type LeadFormFieldType =
  | "text"
  | "email"
  | "phone"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "multi_select"
  | "date"
  | "section"
  | "file";

export interface LeadFormField {
  id: string;
  type: LeadFormFieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
}

export interface LeadFormSchema {
  fields: LeadFormField[];
}

export interface LeadForm {
  id: string;
  company_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  status: "active" | "disabled";
  public_id: string;
  schema: LeadFormSchema;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  submission_count?: number;
}

export interface LeadFormSubmission {
  id: string;
  form_id: string;
  company_id: string;
  answers: Record<string, unknown>;
  schema_snapshot: LeadFormSchema;
  status: "new" | "reviewed";
  created_at: string;
  lead_forms?: { title: string | null } | null;
}

export interface LeadFormUpload {
  id: string;
  submission_id: string;
  form_id: string;
  company_id: string;
  field_id: string;
  bucket: string;
  object_key: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export const FIELD_TYPE_LABELS: Record<LeadFormFieldType, string> = {
  text: "Text",
  email: "Email",
  phone: "Phone",
  textarea: "Long text",
  select: "Dropdown",
  radio: "Single choice",
  checkbox: "Checkbox",
  multi_select: "Multi-select",
  date: "Date",
  section: "Section heading",
  file: "File upload",
};

export const FIELD_TYPES: LeadFormFieldType[] = [
  "text",
  "email",
  "phone",
  "textarea",
  "select",
  "radio",
  "checkbox",
  "multi_select",
  "date",
  "section",
  "file",
];

export const OPTION_FIELD_TYPES = new Set<LeadFormFieldType>(["select", "radio", "multi_select"]);

export const FILE_ACCEPT = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp";
export const FILE_MAX_BYTES = 10 * 1024 * 1024;
export const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const defaultLeadFormSchema: LeadFormSchema = {
  fields: [
    {
      id: "full_name",
      type: "text",
      label: "Full name",
      required: true,
      placeholder: "Jane Smith",
    },
    {
      id: "email",
      type: "email",
      label: "Email",
      required: true,
      placeholder: "jane@example.com",
    },
    {
      id: "phone",
      type: "phone",
      label: "Phone",
      placeholder: "(876) 555-0198",
    },
    {
      id: "message",
      type: "textarea",
      label: "How can we help?",
      placeholder: "Tell us what you are interested in",
    },
  ],
};

export function createPublicId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `lf_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function createField(type: LeadFormFieldType): LeadFormField {
  const id = `field_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const label = FIELD_TYPE_LABELS[type];
  return {
    id,
    type,
    label,
    required: type !== "section" ? false : undefined,
    placeholder: type === "section" ? undefined : "",
    helpText: "",
    options: OPTION_FIELD_TYPES.has(type) ? ["Option 1", "Option 2"] : undefined,
  };
}

export function normalizeSchema(schema: unknown): LeadFormSchema {
  if (!schema || typeof schema !== "object") return defaultLeadFormSchema;
  const fields = Array.isArray((schema as LeadFormSchema).fields) ? (schema as LeadFormSchema).fields : [];
  return {
    fields: fields
      .filter((field) => field && typeof field.id === "string" && typeof field.label === "string")
      .map((field) => ({
        ...field,
        required: field.type === "section" ? undefined : Boolean(field.required),
        options: OPTION_FIELD_TYPES.has(field.type) ? (field.options ?? []).filter(Boolean) : undefined,
      })),
  };
}

export function validateUploadFile(file: File) {
  if (!ALLOWED_FILE_TYPES.has(file.type)) {
    return "Upload a PDF, DOC, DOCX, PNG, JPG, or WEBP file.";
  }
  if (file.size > FILE_MAX_BYTES) {
    return "Files must be 10 MB or smaller.";
  }
  return null;
}

export function answerPreview(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value && typeof value === "object" && "fileName" in value) {
    return String((value as { fileName?: string }).fileName ?? "Uploaded file");
  }
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}
