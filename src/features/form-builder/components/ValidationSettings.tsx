import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  CONFIRMATION_FIELD_TYPES,
  MASK_FIELD_TYPES,
  MASK_PRESET_OPTIONS,
  type LeadFormField,
  type LeadFormMaskPreset,
} from "@/lib/leadForms";

export function ValidationSettings({
  field,
  updateField,
}: {
  field: LeadFormField;
  updateField: (fieldId: string, patch: Partial<LeadFormField>) => void;
}) {
  return (
    <div className="rounded-lg border p-3">
      <h3 className="text-sm font-semibold">Validation</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>Min chars</Label>
          <Input type="number" min={0} value={field.validation?.minLength ?? ""} onChange={(event) => updateField(field.id, { validation: { ...field.validation, minLength: Number(event.target.value) || undefined } })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Max chars</Label>
          <Input type="number" min={0} value={field.validation?.maxLength ?? ""} onChange={(event) => updateField(field.id, { validation: { ...field.validation, maxLength: Number(event.target.value) || undefined } })} />
        </div>
      </div>

      {MASK_FIELD_TYPES.has(field.type) && (
        <div className="mt-3 flex flex-col gap-2">
          <Label>Input mask</Label>
          <Select value={field.validation?.maskPreset ?? "none"} onValueChange={(value) => updateField(field.id, { validation: { ...field.validation, maskPreset: value as LeadFormMaskPreset } })}>
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
          {field.validation?.maskPreset === "custom" && (
            <Input
              placeholder="Use 9 for digits, A for letters, * for either"
              value={field.validation?.customMask ?? ""}
              onChange={(event) => updateField(field.id, { validation: { ...field.validation, customMask: event.target.value } })}
            />
          )}
        </div>
      )}

      {CONFIRMATION_FIELD_TYPES.has(field.type) && (
        <div className="mt-3 flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <Label>Confirmation field</Label>
            <p className="text-xs text-muted-foreground">Ask users to enter this value twice.</p>
          </div>
          <Switch checked={Boolean(field.validation?.requireConfirmation)} onCheckedChange={(checked) => updateField(field.id, { validation: { ...field.validation, requireConfirmation: checked } })} />
        </div>
      )}
    </div>
  );
}
