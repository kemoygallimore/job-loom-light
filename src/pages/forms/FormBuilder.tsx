import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  FileText,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import LeadFormRenderer from "@/components/forms/LeadFormRenderer";
import {
  CONFIRMATION_FIELD_TYPES,
  DEFAULT_FILE_CATEGORIES,
  DEFAULT_FORM_THEME,
  DEFAULT_UPLOAD_MAX_MB,
  FIELD_COLOR_OPTIONS,
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  FILE_CATEGORY_OPTIONS,
  FORM_THEME_OPTIONS,
  LeadForm,
  LeadFormField,
  LeadFormFieldType,
  LeadFormSchema,
  MASK_FIELD_TYPES,
  MASK_PRESET_OPTIONS,
  OPTION_FIELD_TYPES,
  TEXT_LIMIT_FIELD_TYPES,
  createField,
  createPublicId,
  defaultLeadFormSchema,
  normalizeSchema,
} from "@/lib/leadForms";
import { cn } from "@/lib/utils";

type QueryResult = { data: unknown; error: { message: string } | null };
type LeadFormsQuery = PromiseLike<QueryResult> & {
  select: (columns?: string) => LeadFormsQuery;
  insert: (payload: unknown) => LeadFormsQuery;
  update: (payload: unknown) => LeadFormsQuery;
  eq: (column: string, value: unknown) => LeadFormsQuery;
  is: (column: string, value: unknown) => LeadFormsQuery;
  maybeSingle: () => LeadFormsQuery;
};
type LeadFormsDb = {
  from: (table: string) => LeadFormsQuery;
};

const leadFormsDb = supabase as unknown as LeadFormsDb;

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function blankDraft(companyId: string, userId: string): Partial<LeadForm> {
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

function fieldOptionsText(field: LeadFormField) {
  return (field.options ?? []).join("\n");
}

function parseOptions(value: string) {
  return value
    .split("\n")
    .map((option) => option.trim())
    .filter(Boolean);
}

function cloneSchema(schema: LeadFormSchema) {
  return normalizeSchema(JSON.parse(JSON.stringify(schema)));
}

export default function FormBuilder() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [draft, setDraft] = useState<Partial<LeadForm> | null>(null);
  const [editingForm, setEditingForm] = useState<LeadForm | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isEditing = Boolean(formId);

  const markDirty = () => setDirty(true);

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

    const { data, error } = await leadFormsDb
      .from("lead_forms")
      .select("*")
      .eq("id", formId)
      .eq("company_id", profile.company_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !data) {
      toast.error(error?.message ?? "Form not found");
      setLoading(false);
      navigate("/forms", { replace: true });
      return;
    }

    const form = { ...(data as LeadForm), schema: normalizeSchema((data as LeadForm).schema) };
    setEditingForm(form);
    setDraft({ ...form, schema: cloneSchema(form.schema) });
    setSelectedFieldId(form.schema.fields[0]?.id ?? null);
    setLoading(false);
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
    const payload = {
      company_id: profile.company_id,
      created_by: editingForm?.created_by ?? user.id,
      title: draft.title.trim(),
      description: draft.description?.trim() || null,
      status: draft.status ?? "active",
      public_id: draft.public_id ?? createPublicId(),
      schema: normalizeSchema(draft.schema),
    };

    const query = editingForm
      ? leadFormsDb.from("lead_forms").update(payload).eq("id", editingForm.id).eq("company_id", profile.company_id)
      : leadFormsDb.from("lead_forms").insert(payload);
    const { error } = await query;
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editingForm ? "Form updated" : "Form created");
    setDirty(false);
    navigate("/forms");
  };

  const confirmLeave = () => !dirty || window.confirm("You have unsaved form changes. Leave without saving?");

  const leaveBuilder = () => {
    if (!confirmLeave()) return;
    navigate("/forms");
  };

  if (accessError) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">Forms unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{accessError}</p>
          <Button type="button" className="mt-4" onClick={() => navigate("/forms")}>
            Back to forms
          </Button>
        </div>
      </div>
    );
  }

  if (loading || !draft?.schema) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-9" onClick={leaveBuilder}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <FileText className="size-6 text-primary" />
              {isEditing ? "Edit form" : "Build form"}
            </h1>
            <p className="text-sm text-muted-foreground">Design fields, validation, uploads, and public form styling.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <Badge variant="secondary">Unsaved changes</Badge>}
          <Button variant="outline" type="button" onClick={leaveBuilder}>
            Forms
          </Button>
          <Button onClick={saveForm} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Saving..." : "Save form"}
          </Button>
        </div>
      </div>

      <div className="grid flex-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)_340px]">
        <aside className="rounded-lg border bg-card p-3">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">Field palette</h2>
            <p className="text-xs text-muted-foreground">Add fields to the canvas.</p>
          </div>
          <div className="grid gap-2">
            {FIELD_TYPES.map((type) => (
              <Button key={type} type="button" variant="outline" className="justify-start" onClick={() => addField(type)}>
                <Plus className="size-4" />
                {FIELD_TYPE_LABELS[type]}
              </Button>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-col gap-4">
          <section className="rounded-lg border bg-card p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px]">
              <div className="flex flex-col gap-2">
                <Label>Form title</Label>
                <Input value={draft.title ?? ""} onChange={(event) => updateDraft({ title: event.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select value={draft.status ?? "active"} onValueChange={(value) => updateDraft({ status: value as LeadForm["status"] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Theme</Label>
                <Select
                  value={draft.schema.theme ?? DEFAULT_FORM_THEME}
                  onValueChange={(value) => updateSchema({ ...draft.schema!, theme: value as LeadFormSchema["theme"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORM_THEME_OPTIONS.map((theme) => (
                      <SelectItem key={theme.value} value={theme.value}>
                        {theme.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea rows={2} value={draft.description ?? ""} onChange={(event) => updateDraft({ description: event.target.value })} />
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Live preview</h2>
                <p className="text-xs text-muted-foreground">Select a field to customize it.</p>
              </div>
              <Badge variant="secondary">{draft.schema.fields.length} fields</Badge>
            </div>
            <LeadFormRenderer
              schema={draft.schema}
              values={{}}
              disabled
              selectedFieldId={selectedFieldId}
              onChange={() => {}}
              onFieldSelect={(field) => setSelectedFieldId(field.id)}
            />
          </section>
        </main>

        <aside className="rounded-lg border bg-card p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Field settings</h2>
              <p className="text-xs text-muted-foreground">Tune the selected field.</p>
            </div>
            {selectedField && <Badge variant="secondary">{FIELD_TYPE_LABELS[selectedField.type]}</Badge>}
          </div>

          {!selectedField ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Select a field from the preview or add a new one.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={draft.schema.fields[0]?.id === selectedField.id}
                  onClick={() => moveField(selectedField.id, -1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={draft.schema.fields[draft.schema.fields.length - 1]?.id === selectedField.id}
                  onClick={() => moveField(selectedField.id, 1)}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                  <GripVertical className="size-4" />
                  Reorder
                </div>
                <Button type="button" variant="outline" size="icon" className="size-8" onClick={() => removeField(selectedField.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Label</Label>
                <Input value={selectedField.label} onChange={(event) => updateField(selectedField.id, { label: event.target.value })} />
              </div>

              {selectedField.type !== "section" && (
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <Label>Required</Label>
                    <p className="text-xs text-muted-foreground">Submission cannot skip it.</p>
                  </div>
                  <Switch
                    checked={Boolean(selectedField.required)}
                    onCheckedChange={(checked) => updateField(selectedField.id, { required: checked })}
                  />
                </div>
              )}

              {selectedField.type !== "section" && selectedField.type !== "file" && selectedField.type !== "rating" && (
                <div className="flex flex-col gap-2">
                  <Label>Placeholder</Label>
                  <Input
                    value={selectedField.placeholder ?? ""}
                    onChange={(event) => updateField(selectedField.id, { placeholder: event.target.value })}
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label>Help text</Label>
                <Input
                  value={selectedField.helpText ?? ""}
                  onChange={(event) => updateField(selectedField.id, { helpText: event.target.value })}
                />
              </div>

              {OPTION_FIELD_TYPES.has(selectedField.type) && (
                <div className="flex flex-col gap-2">
                  <Label>Options</Label>
                  <Textarea
                    rows={4}
                    value={fieldOptionsText(selectedField)}
                    onChange={(event) => updateField(selectedField.id, { options: parseOptions(event.target.value) })}
                  />
                </div>
              )}

              {TEXT_LIMIT_FIELD_TYPES.has(selectedField.type) && (
                <div className="rounded-lg border p-3">
                  <h3 className="text-sm font-semibold">Validation</h3>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <Label>Min chars</Label>
                      <Input
                        type="number"
                        min={0}
                        value={selectedField.validation?.minLength ?? ""}
                        onChange={(event) =>
                          updateField(selectedField.id, {
                            validation: { ...selectedField.validation, minLength: Number(event.target.value) || undefined },
                          })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Max chars</Label>
                      <Input
                        type="number"
                        min={0}
                        value={selectedField.validation?.maxLength ?? ""}
                        onChange={(event) =>
                          updateField(selectedField.id, {
                            validation: { ...selectedField.validation, maxLength: Number(event.target.value) || undefined },
                          })
                        }
                      />
                    </div>
                  </div>

                  {MASK_FIELD_TYPES.has(selectedField.type) && (
                    <div className="mt-3 flex flex-col gap-2">
                      <Label>Input mask</Label>
                      <Select
                        value={selectedField.validation?.maskPreset ?? "none"}
                        onValueChange={(value) =>
                          updateField(selectedField.id, {
                            validation: { ...selectedField.validation, maskPreset: value as LeadFormField["validation"]["maskPreset"] },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MASK_PRESET_OPTIONS.map((mask) => (
                            <SelectItem key={mask.value} value={mask.value}>
                              {mask.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedField.validation?.maskPreset === "custom" && (
                        <Input
                          placeholder="Use 9 for digits, A for letters, * for either"
                          value={selectedField.validation?.customMask ?? ""}
                          onChange={(event) =>
                            updateField(selectedField.id, {
                              validation: { ...selectedField.validation, customMask: event.target.value },
                            })
                          }
                        />
                      )}
                    </div>
                  )}

                  {CONFIRMATION_FIELD_TYPES.has(selectedField.type) && (
                    <div className="mt-3 flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <Label>Confirmation field</Label>
                        <p className="text-xs text-muted-foreground">Ask users to enter this value twice.</p>
                      </div>
                      <Switch
                        checked={Boolean(selectedField.validation?.requireConfirmation)}
                        onCheckedChange={(checked) =>
                          updateField(selectedField.id, {
                            validation: { ...selectedField.validation, requireConfirmation: checked },
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {selectedField.type === "file" && (
                <div className="rounded-lg border p-3">
                  <h3 className="text-sm font-semibold">File upload</h3>
                  <div className="mt-3 flex flex-col gap-2">
                    <Label>Max size in MB</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={selectedField.upload?.maxSizeMb ?? DEFAULT_UPLOAD_MAX_MB}
                      onChange={(event) =>
                        updateField(selectedField.id, {
                          upload: { ...selectedField.upload, maxSizeMb: Number(event.target.value) || DEFAULT_UPLOAD_MAX_MB },
                        })
                      }
                    />
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    <Label>Allowed types</Label>
                    {FILE_CATEGORY_OPTIONS.map((category) => {
                      const selected = selectedField.upload?.allowedCategories ?? DEFAULT_FILE_CATEGORIES;
                      return (
                        <label key={category.value} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                          <Checkbox
                            checked={selected.includes(category.value)}
                            onCheckedChange={(checked) => {
                              const next = checked
                                ? [...selected, category.value]
                                : selected.filter((item) => item !== category.value);
                              updateField(selectedField.id, {
                                upload: {
                                  ...selectedField.upload,
                                  allowedCategories: next.length > 0 ? next : DEFAULT_FILE_CATEGORIES,
                                },
                              });
                            }}
                          />
                          {category.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedField.type !== "section" && (
                <div className="rounded-lg border p-3">
                  <h3 className="text-sm font-semibold">Field color</h3>
                  <div className="mt-3 grid gap-3">
                    <div className="flex flex-col gap-2">
                      <Label>Accent</Label>
                      <Select
                        value={selectedField.style?.accent ?? "default"}
                        onValueChange={(value) =>
                          updateField(selectedField.id, {
                            style: { ...selectedField.style, accent: value as LeadFormField["style"]["accent"] },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_COLOR_OPTIONS.map((color) => (
                            <SelectItem key={color.value} value={color.value}>
                              {color.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Background</Label>
                      <Select
                        value={selectedField.style?.background ?? "default"}
                        onValueChange={(value) =>
                          updateField(selectedField.id, {
                            style: { ...selectedField.style, background: value as LeadFormField["style"]["background"] },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_COLOR_OPTIONS.map((color) => (
                            <SelectItem key={color.value} value={color.value}>
                              {color.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
