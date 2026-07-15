import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  blankDraft,
  buildLeadFormPayload,
  cloneSchema,
  getLeadFormForEdit,
  insertLeadForm,
  updateLeadForm,
} from "@/features/form-builder/api";
import { BuilderHeader } from "@/features/form-builder/components/BuilderHeader";
import { FieldPalette } from "@/features/form-builder/components/FieldPalette";
import { FieldSettingsPanel } from "@/features/form-builder/components/FieldSettingsPanel";
import { FormCanvas } from "@/features/form-builder/components/FormCanvas";
import { FormBuilderAccessError, FormBuilderLoading } from "@/features/form-builder/components/BuilderStates";
import { LeaveGuardDialog } from "@/features/form-builder/components/LeaveGuardDialog";
import type { DraftLeadForm } from "@/features/form-builder/types";
import {
  createField,
  normalizeSchema,
  type LeadForm,
  type LeadFormField,
  type LeadFormFieldType,
  type LeadFormSchema,
} from "@/lib/leadForms";

export default function FormBuilder() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [draft, setDraft] = useState<DraftLeadForm | null>(null);
  const [editingForm, setEditingForm] = useState<LeadForm | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const isEditing = Boolean(formId);

  const load = useCallback(async () => {
    if (!user?.id) {
      setAccessError("Sign in again to continue building forms.");
      setLoading(false);
      return;
    }
    if (!profile?.company_id) {
      setAccessError("Your account is missing a company profile. Refresh or contact an administrator.");
      setLoading(false);
      return;
    }
    setAccessError(null);
    setLoading(true);

    if (!formId) {
      const nextDraft = blankDraft(profile.company_id, user.id);
      setDraft(nextDraft);
      setEditingForm(null);
      setSelectedFieldId(nextDraft.schema?.fields[0]?.id ?? null);
      setLoading(false);
      return;
    }

    try {
      const form = await getLeadFormForEdit(formId, profile.company_id);
      if (!form) {
        toast.error("Form not found");
        setLoading(false);
        navigate("/forms", { replace: true });
        return;
      }

      setEditingForm(form);
      setDraft({ ...form, schema: cloneSchema(form.schema) });
      setSelectedFieldId(form.schema.fields[0]?.id ?? null);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Form not found");
      navigate("/forms", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [formId, navigate, profile?.company_id, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const selectedField = useMemo(() => {
    return draft?.schema?.fields.find((field) => field.id === selectedFieldId) ?? null;
  }, [draft?.schema?.fields, selectedFieldId]);

  const markDirty = () => setDirty(true);

  const updateDraft = (patch: Partial<LeadForm>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    markDirty();
  };

  const updateSchema = (schema: LeadFormSchema) => {
    updateDraft({ schema: normalizeSchema(schema) });
  };

  const updateField = (fieldId: string, patch: Partial<LeadFormField>) => {
    if (!draft?.schema) return;
    updateSchema({
      ...draft.schema,
      fields: draft.schema.fields.map((field) => (field.id === fieldId ? normalizeSchema({ fields: [{ ...field, ...patch }] }).fields[0] : field)),
    });
  };

  const addField = (type: LeadFormFieldType) => {
    if (!draft?.schema) return;
    const nextField = createField(type);
    updateSchema({ ...draft.schema, fields: [...draft.schema.fields, nextField] });
    setSelectedFieldId(nextField.id);
  };

  const removeField = (fieldId: string) => {
    if (!draft?.schema) return;
    const fields = draft.schema.fields.filter((field) => field.id !== fieldId);
    updateSchema({ ...draft.schema, fields });
    setSelectedFieldId(fields[0]?.id ?? null);
  };

  const moveField = (fieldId: string, direction: -1 | 1) => {
    if (!draft?.schema) return;
    const fields = [...draft.schema.fields];
    const index = fields.findIndex((field) => field.id === fieldId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= fields.length) return;
    const [field] = fields.splice(index, 1);
    fields.splice(nextIndex, 0, field);
    updateSchema({ ...draft.schema, fields });
  };

  const saveForm = async () => {
    if (!draft || !profile?.company_id || !user?.id) return;
    if (!draft.title?.trim()) {
      toast.error("Form title is required");
      return;
    }
    if (!draft.schema?.fields.length) {
      toast.error("Add at least one field");
      return;
    }

    setSaving(true);
    try {
      const payload = buildLeadFormPayload(draft, profile.company_id, user.id, editingForm);
      if (editingForm) await updateLeadForm(editingForm.id, profile.company_id, payload);
      else await insertLeadForm(payload);
      toast.success(editingForm ? "Form updated" : "Form created");
      setDirty(false);
      navigate("/forms");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save form");
    } finally {
      setSaving(false);
    }
  };

  const leaveBuilder = () => {
    if (dirty) {
      setLeaveDialogOpen(true);
      return;
    }
    navigate("/forms");
  };

  const discardAndLeave = () => {
    setLeaveDialogOpen(false);
    setDirty(false);
    navigate("/forms");
  };

  if (accessError) return <FormBuilderAccessError message={accessError} onBack={() => navigate("/forms")} />;
  if (loading || !draft?.schema) return <FormBuilderLoading />;

  const readyDraft = draft as DraftLeadForm & { schema: LeadFormSchema };

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-4">
      <BuilderHeader isEditing={isEditing} dirty={dirty} saving={saving} onLeave={leaveBuilder} onSave={saveForm} />
      <div className="grid flex-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)_340px] xl:items-start">
        <FieldPalette className="xl:sticky xl:top-0 xl:max-h-[calc(100vh-4rem)] xl:self-start xl:overflow-y-auto" onAddField={addField} />
        <FormCanvas
          draft={readyDraft}
          selectedFieldId={selectedFieldId}
          updateDraft={updateDraft}
          updateSchema={updateSchema}
          setSelectedFieldId={setSelectedFieldId}
        />
        <FieldSettingsPanel
          className="xl:sticky xl:top-0 xl:max-h-[calc(100vh-4rem)] xl:self-start xl:overflow-y-auto"
          schema={readyDraft.schema}
          selectedField={selectedField}
          updateField={updateField}
          moveField={moveField}
          removeField={removeField}
        />
      </div>
      <LeaveGuardDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen} onDiscard={discardAndLeave} />
    </div>
  );
}
