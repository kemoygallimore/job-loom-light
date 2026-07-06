export type LeadFormFieldType =
  | "text"
  | "email"
  | "phone"
  | "textarea"
  | "number"
  | "url"
  | "address"
  | "rating"
  | "select"
  | "radio"
  | "checkbox"
  | "multi_select"
  | "date"
  | "section"
  | "file";

export type LeadFormTheme = "blue" | "green" | "slate" | "rose" | "amber";
export type LeadFormFieldColor = "default" | "blue" | "green" | "slate" | "rose" | "amber";
export type LeadFormMaskPreset = "none" | "phone" | "zip" | "ssn" | "date" | "custom";
export type LeadFormFileCategory = "documents" | "images";

export interface LeadFormFieldValidation {
  minLength?: number;
  maxLength?: number;
  maskPreset?: LeadFormMaskPreset;
  customMask?: string;
  requireConfirmation?: boolean;
}

export interface LeadFormUploadSettings {
  maxSizeMb?: number;
  allowedCategories?: LeadFormFileCategory[];
}

export interface LeadFormFieldStyle {
  accent?: LeadFormFieldColor;
  background?: LeadFormFieldColor;
}

export interface LeadFormField {
  id: string;
  type: LeadFormFieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  validation?: LeadFormFieldValidation;
  upload?: LeadFormUploadSettings;
  style?: LeadFormFieldStyle;
}

export interface LeadFormSchema {
  fields: LeadFormField[];
  theme?: LeadFormTheme;
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
  number: "Number",
  url: "URL",
  address: "Address",
  rating: "Rating",
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
  "number",
  "url",
  "address",
  "rating",
  "select",
  "radio",
  "checkbox",
  "multi_select",
  "date",
  "section",
  "file",
];

export const OPTION_FIELD_TYPES = new Set<LeadFormFieldType>(["select", "radio", "multi_select"]);
export const TEXT_LIMIT_FIELD_TYPES = new Set<LeadFormFieldType>(["text", "email", "phone", "textarea", "url", "address"]);
export const MASK_FIELD_TYPES = new Set<LeadFormFieldType>(["text", "email", "phone", "url"]);
export const CONFIRMATION_FIELD_TYPES = new Set<LeadFormFieldType>(["text", "email", "phone", "url"]);

export const FORM_THEME_OPTIONS: { value: LeadFormTheme; label: string }[] = [
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "slate", label: "Slate" },
  { value: "rose", label: "Rose" },
  { value: "amber", label: "Amber" },
];

export const FIELD_COLOR_OPTIONS: { value: LeadFormFieldColor; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "slate", label: "Slate" },
  { value: "rose", label: "Rose" },
  { value: "amber", label: "Amber" },
];

export const MASK_PRESET_OPTIONS: { value: LeadFormMaskPreset; label: string; pattern?: string }[] = [
  { value: "none", label: "None" },
  { value: "phone", label: "Phone", pattern: "(999) 999-9999" },
  { value: "zip", label: "ZIP code", pattern: "99999" },
  { value: "ssn", label: "SSN-style", pattern: "999-99-9999" },
  { value: "date", label: "Date", pattern: "99/99/9999" },
  { value: "custom", label: "Custom" },
];

export const FILE_CATEGORY_OPTIONS: { value: LeadFormFileCategory; label: string }[] = [
  { value: "documents", label: "Documents" },
  { value: "images", label: "Images" },
];

export const DEFAULT_FORM_THEME: LeadFormTheme = "blue";
export const DEFAULT_FIELD_COLOR: LeadFormFieldColor = "default";
export const DEFAULT_UPLOAD_MAX_MB = 10;
export const DEFAULT_FILE_CATEGORIES: LeadFormFileCategory[] = ["documents", "images"];

export const FILE_TYPES_BY_CATEGORY: Record<LeadFormFileCategory, string[]> = {
  documents: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  images: ["image/png", "image/jpeg", "image/webp"],
};

export const FILE_ACCEPT_BY_CATEGORY: Record<LeadFormFileCategory, string[]> = {
  documents: [".pdf", ".doc", ".docx"],
  images: [".png", ".jpg", ".jpeg", ".webp"],
};

export const FILE_ACCEPT = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp";
export const FILE_MAX_BYTES = DEFAULT_UPLOAD_MAX_MB * 1024 * 1024;
export const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const defaultLeadFormSchema: LeadFormSchema = {
  theme: DEFAULT_FORM_THEME,
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
      validation: { maskPreset: "phone" },
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
    validation: TEXT_LIMIT_FIELD_TYPES.has(type) ? { maskPreset: type === "phone" ? "phone" : "none" } : undefined,
    upload: type === "file" ? { maxSizeMb: DEFAULT_UPLOAD_MAX_MB, allowedCategories: DEFAULT_FILE_CATEGORIES } : undefined,
    style: type !== "section" ? { accent: DEFAULT_FIELD_COLOR, background: DEFAULT_FIELD_COLOR } : undefined,
  };
}

function numberOrUndefined(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : undefined;
}

function normalizeValidation(field: LeadFormField): LeadFormFieldValidation | undefined {
  if (!TEXT_LIMIT_FIELD_TYPES.has(field.type)) return undefined;
  const validation = field.validation ?? {};
  const maskPreset = MASK_FIELD_TYPES.has(field.type) ? validation.maskPreset ?? "none" : "none";
  return {
    minLength: numberOrUndefined(validation.minLength),
    maxLength: numberOrUndefined(validation.maxLength),
    maskPreset,
    customMask: maskPreset === "custom" ? validation.customMask ?? "" : undefined,
    requireConfirmation: CONFIRMATION_FIELD_TYPES.has(field.type)
      ? Boolean(validation.requireConfirmation)
      : undefined,
  };
}

function normalizeUpload(field: LeadFormField): LeadFormUploadSettings | undefined {
  if (field.type !== "file") return undefined;
  const upload = field.upload ?? {};
  const allowedCategories = (upload.allowedCategories ?? DEFAULT_FILE_CATEGORIES).filter((category) =>
    FILE_CATEGORY_OPTIONS.some((option) => option.value === category),
  );
  return {
    maxSizeMb: numberOrUndefined(upload.maxSizeMb) || DEFAULT_UPLOAD_MAX_MB,
    allowedCategories: allowedCategories.length > 0 ? allowedCategories : DEFAULT_FILE_CATEGORIES,
  };
}

function normalizeStyle(field: LeadFormField): LeadFormFieldStyle | undefined {
  if (field.type === "section") return undefined;
  const style = field.style ?? {};
  const colors = new Set(FIELD_COLOR_OPTIONS.map((option) => option.value));
  return {
    accent: colors.has(style.accent ?? DEFAULT_FIELD_COLOR) ? style.accent ?? DEFAULT_FIELD_COLOR : DEFAULT_FIELD_COLOR,
    background: colors.has(style.background ?? DEFAULT_FIELD_COLOR)
      ? style.background ?? DEFAULT_FIELD_COLOR
      : DEFAULT_FIELD_COLOR,
  };
}

export function normalizeSchema(schema: unknown): LeadFormSchema {
  if (!schema || typeof schema !== "object") return defaultLeadFormSchema;
  const fields = Array.isArray((schema as LeadFormSchema).fields) ? (schema as LeadFormSchema).fields : [];
  const theme = (schema as LeadFormSchema).theme;
  const validThemes = new Set(FORM_THEME_OPTIONS.map((option) => option.value));
  return {
    theme: validThemes.has(theme ?? DEFAULT_FORM_THEME) ? theme ?? DEFAULT_FORM_THEME : DEFAULT_FORM_THEME,
    fields: fields
      .filter((field) => field && typeof field.id === "string" && typeof field.label === "string")
      .filter((field) => FIELD_TYPES.includes(field.type))
      .map((field) => {
        const normalizedField = {
          ...field,
          required: field.type === "section" ? undefined : Boolean(field.required),
          options: OPTION_FIELD_TYPES.has(field.type) ? (field.options ?? []).filter(Boolean) : undefined,
        };
        return {
          ...normalizedField,
          validation: normalizeValidation(normalizedField),
          upload: normalizeUpload(normalizedField),
          style: normalizeStyle(normalizedField),
        };
      }),
  };
}

export function getMaskPattern(field: LeadFormField) {
  const preset = field.validation?.maskPreset ?? "none";
  if (preset === "custom") return field.validation?.customMask?.trim() || "";
  return MASK_PRESET_OPTIONS.find((option) => option.value === preset)?.pattern ?? "";
}

function acceptsMaskChar(patternChar: string, valueChar: string) {
  if (patternChar === "9") return /\d/.test(valueChar);
  if (patternChar === "A") return /[a-z]/i.test(valueChar);
  if (patternChar === "*") return /[a-z0-9]/i.test(valueChar);
  return patternChar === valueChar;
}

export function applyInputMask(field: LeadFormField, input: string) {
  const pattern = getMaskPattern(field);
  if (!pattern) return input;

  let nextValue = "";
  let rawIndex = 0;
  const raw = input.replace(/[^a-z0-9]/gi, "");

  for (const patternChar of pattern) {
    if (rawIndex >= raw.length) break;
    if (["9", "A", "*"].includes(patternChar)) {
      const nextChar = raw[rawIndex];
      if (acceptsMaskChar(patternChar, nextChar)) {
        nextValue += nextChar;
        rawIndex += 1;
      } else {
        rawIndex += 1;
      }
    } else {
      nextValue += patternChar;
    }
  }

  return nextValue;
}

export function matchesInputMask(field: LeadFormField, value: string) {
  const pattern = getMaskPattern(field);
  if (!pattern) return true;
  if (value.length !== pattern.length) return false;
  return Array.from(pattern).every((patternChar, index) => acceptsMaskChar(patternChar, value[index]));
}

export function getFileAccept(field?: LeadFormField) {
  const categories = field?.upload?.allowedCategories ?? DEFAULT_FILE_CATEGORIES;
  return categories.flatMap((category) => FILE_ACCEPT_BY_CATEGORY[category] ?? []).join(",");
}

export function getAllowedFileTypes(field?: LeadFormField) {
  const categories = field?.upload?.allowedCategories ?? DEFAULT_FILE_CATEGORIES;
  return new Set(categories.flatMap((category) => FILE_TYPES_BY_CATEGORY[category] ?? []));
}

export function getMaxFileBytes(field?: LeadFormField) {
  const maxSizeMb = field?.upload?.maxSizeMb || DEFAULT_UPLOAD_MAX_MB;
  return maxSizeMb * 1024 * 1024;
}

export function validateUploadFile(file: File, field?: LeadFormField) {
  const allowedFileTypes = getAllowedFileTypes(field);
  if (!allowedFileTypes.has(file.type)) {
    return "Upload a file type allowed for this field.";
  }
  if (file.size > getMaxFileBytes(field)) {
    return `Files must be ${field?.upload?.maxSizeMb || DEFAULT_UPLOAD_MAX_MB} MB or smaller.`;
  }
  return null;
}

export type LeadFormValue = string | boolean | string[] | File | null | undefined;

export function isEmptyLeadFormValue(value: LeadFormValue) {
  if (value instanceof File) return false;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "boolean") return value === false;
  return value === null || value === undefined || String(value).trim() === "";
}

export function validateLeadFormFieldValue(
  field: LeadFormField,
  value: LeadFormValue,
  confirmationValue?: LeadFormValue,
) {
  if (field.type === "section") return null;
  if (field.required && isEmptyLeadFormValue(value)) return "This field is required.";
  if (isEmptyLeadFormValue(value)) return null;

  if (field.type === "email" && typeof value === "string" && !/^\S+@\S+\.\S+$/.test(value.trim())) {
    return "Enter a valid email address.";
  }

  if (field.type === "url" && typeof value === "string") {
    try {
      new URL(value);
    } catch {
      return "Enter a valid URL.";
    }
  }

  if (["text", "email", "phone", "textarea", "url", "address"].includes(field.type) && typeof value === "string") {
    const length = value.trim().length;
    if (field.validation?.minLength && length < field.validation.minLength) {
      return `Enter at least ${field.validation.minLength} characters.`;
    }
    if (field.validation?.maxLength && length > field.validation.maxLength) {
      return `Enter no more than ${field.validation.maxLength} characters.`;
    }
  }

  const pattern = getMaskPattern(field);
  if (pattern && typeof value === "string" && !matchesInputMask(field, value)) {
    return "Complete the required format.";
  }

  if (field.validation?.requireConfirmation && typeof value === "string") {
    if (value !== confirmationValue) return "Confirmation must match.";
  }

  if (field.type === "file" && value instanceof File) {
    return validateUploadFile(value, field);
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
