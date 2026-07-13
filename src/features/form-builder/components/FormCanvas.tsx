import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import LeadFormRenderer from "@/components/forms/LeadFormRenderer";
import {
  DEFAULT_FORM_THEME,
  FORM_THEME_OPTIONS,
  type LeadForm,
  type LeadFormField,
  type LeadFormSchema,
} from "@/lib/leadForms";
import type { DraftLeadForm } from "../types";

interface FormCanvasProps {
  draft: DraftLeadForm & { schema: LeadFormSchema };
  selectedFieldId: string | null;
  updateDraft: (patch: Partial<LeadForm>) => void;
  updateSchema: (schema: LeadFormSchema) => void;
  setSelectedFieldId: (fieldId: string | null) => void;
}

export function FormCanvas({ draft, selectedFieldId, updateDraft, updateSchema, setSelectedFieldId }: FormCanvasProps) {
  return (
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
              onValueChange={(value) => updateSchema({ ...draft.schema, theme: value as LeadFormSchema["theme"] })}
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
        {draft.schema.fields.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Add a field from the palette to start building this form.
          </div>
        ) : (
          <LeadFormRenderer
            schema={draft.schema}
            values={{}}
            disabled
            selectedFieldId={selectedFieldId}
            onChange={() => {}}
            onFieldSelect={(field: LeadFormField) => setSelectedFieldId(field.id)}
          />
        )}
      </section>
    </main>
  );
}
