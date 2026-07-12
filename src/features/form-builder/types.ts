import type { LeadForm, LeadFormField, LeadFormFieldType, LeadFormSchema } from "@/lib/leadForms";

export type DraftLeadForm = Partial<LeadForm> & { schema?: LeadFormSchema };

export interface FieldSettingsActions {
  updateField: (fieldId: string, patch: Partial<LeadFormField>) => void;
  moveField: (fieldId: string, direction: -1 | 1) => void;
  removeField: (fieldId: string) => void;
}

export interface BuilderActions {
  updateDraft: (patch: Partial<LeadForm>) => void;
  updateSchema: (schema: LeadFormSchema) => void;
  addField: (type: LeadFormFieldType) => void;
}
