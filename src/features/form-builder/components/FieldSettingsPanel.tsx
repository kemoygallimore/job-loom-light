import { ArrowDown, ArrowUp, GripVertical, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  FIELD_TYPE_LABELS,
  OPTION_FIELD_TYPES,
  TEXT_LIMIT_FIELD_TYPES,
  type LeadFormField,
  type LeadFormSchema,
} from "@/lib/leadForms";
import { cn } from "@/lib/utils";
import type { FieldSettingsActions } from "../types";
import { FieldColorSettings } from "./FieldColorSettings";
import { FileUploadSettings } from "./FileUploadSettings";
import { ValidationSettings } from "./ValidationSettings";

function fieldOptionsText(field: LeadFormField) {
  return (field.options ?? []).join("\n");
}

function parseOptions(value: string) {
  return value
    .split("\n")
    .map((option) => option.trim())
    .filter(Boolean);
}

interface FieldSettingsPanelProps extends FieldSettingsActions {
  className?: string;
  schema: LeadFormSchema;
  selectedField: LeadFormField | null;
}

export function FieldSettingsPanel({ className, schema, selectedField, updateField, moveField, removeField }: FieldSettingsPanelProps) {
  return (
    <aside aria-label="Field settings" className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Field settings</h2>
          <p className="text-xs text-muted-foreground">Tune the selected field.</p>
        </div>
        {selectedField && <Badge variant="secondary">{FIELD_TYPE_LABELS[selectedField.type]}</Badge>}
      </div>

      {!selectedField ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Select a field from the preview or add one from the palette to customize labels, validation, uploads, and styling.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="icon" className="size-8" disabled={schema.fields[0]?.id === selectedField.id} onClick={() => moveField(selectedField.id, -1)}>
              <ArrowUp className="size-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" className="size-8" disabled={schema.fields[schema.fields.length - 1]?.id === selectedField.id} onClick={() => moveField(selectedField.id, 1)}>
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

          <div className="rounded-lg border p-3">
            <h3 className="text-sm font-semibold">Basics</h3>
            <div className="mt-3 flex flex-col gap-3">
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
                  <Switch checked={Boolean(selectedField.required)} onCheckedChange={(checked) => updateField(selectedField.id, { required: checked })} />
                </div>
              )}

              {selectedField.type !== "section" && selectedField.type !== "file" && selectedField.type !== "rating" && (
                <div className="flex flex-col gap-2">
                  <Label>Placeholder</Label>
                  <Input value={selectedField.placeholder ?? ""} onChange={(event) => updateField(selectedField.id, { placeholder: event.target.value })} />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label>Help text</Label>
                <Input value={selectedField.helpText ?? ""} onChange={(event) => updateField(selectedField.id, { helpText: event.target.value })} />
              </div>
            </div>
          </div>

          {OPTION_FIELD_TYPES.has(selectedField.type) && (
            <div className="flex flex-col gap-2">
              <Label>Options</Label>
              <Textarea rows={4} value={fieldOptionsText(selectedField)} onChange={(event) => updateField(selectedField.id, { options: parseOptions(event.target.value) })} />
            </div>
          )}

          {TEXT_LIMIT_FIELD_TYPES.has(selectedField.type) && <ValidationSettings field={selectedField} updateField={updateField} />}
          {selectedField.type === "file" && <FileUploadSettings field={selectedField} updateField={updateField} />}
          {selectedField.type !== "section" && <FieldColorSettings field={selectedField} updateField={updateField} />}
        </div>
      )}
    </aside>
  );
}
