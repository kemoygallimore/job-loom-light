import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  createPublicId,
  defaultLeadFormSchema,
  normalizeSchema,
  type LeadForm,
  type LeadFormSchema,
} from "@/lib/leadForms";
import type { DraftLeadForm } from "./types";

type LeadFormRow = Database["public"]["Tables"]["lead_forms"]["Row"];
type LeadFormInsert = Database["public"]["Tables"]["lead_forms"]["Insert"];
type LeadFormUpdate = Database["public"]["Tables"]["lead_forms"]["Update"];

export function blankDraft(companyId: string, userId: string): DraftLeadForm {
  return {
    company_id: companyId,
    created_by: userId,
    title: "",
    description: "",
    status: "active",
    public_id: createPublicId(),
    schema: normalizeSchema(defaultLeadFormSchema),
  };
}

export function cloneSchema(schema: LeadFormSchema) {
  return normalizeSchema(JSON.parse(JSON.stringify(schema)));
}

function toLeadForm(row: LeadFormRow): LeadForm {
  return {
    ...row,
    status: row.status === "disabled" ? "disabled" : "active",
    schema: normalizeSchema(row.schema),
  };
}

function schemaJson(schema: LeadFormSchema): Json {
  return schema as unknown as Json;
}

export async function getLeadFormForEdit(formId: string, companyId: string): Promise<LeadForm | null> {
  const { data, error } = await supabase
    .from("lead_forms")
    .select("*")
    .eq("id", formId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data ? toLeadForm(data) : null;
}

export function buildLeadFormPayload(draft: DraftLeadForm, companyId: string, userId: string, editingForm?: LeadForm | null) {
  return {
    company_id: companyId,
    created_by: editingForm?.created_by ?? userId,
    title: draft.title?.trim() ?? "",
    description: draft.description?.trim() || null,
    status: draft.status ?? "active",
    public_id: draft.public_id ?? createPublicId(),
    schema: schemaJson(normalizeSchema(draft.schema)),
  };
}

export async function insertLeadForm(payload: LeadFormInsert) {
  const { error } = await supabase.from("lead_forms").insert(payload);
  if (error) throw error;
}

export async function updateLeadForm(formId: string, companyId: string, payload: LeadFormUpdate) {
  const { error } = await supabase.from("lead_forms").update(payload).eq("id", formId).eq("company_id", companyId);
  if (error) throw error;
}
