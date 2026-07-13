import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FIELD_COLOR_OPTIONS, type LeadFormField, type LeadFormFieldColor } from "@/lib/leadForms";

export function FieldColorSettings({
  field,
  updateField,
}: {
  field: LeadFormField;
  updateField: (fieldId: string, patch: Partial<LeadFormField>) => void;
}) {
  return (
    <div className="rounded-lg border p-3">
      <h3 className="text-sm font-semibold">Field color</h3>
      <div className="mt-3 grid gap-3">
        <div className="flex flex-col gap-2">
          <Label>Accent</Label>
          <Select value={field.style?.accent ?? "default"} onValueChange={(value) => updateField(field.id, { style: { ...field.style, accent: value as LeadFormFieldColor } })}>
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
          <Select value={field.style?.background ?? "default"} onValueChange={(value) => updateField(field.id, { style: { ...field.style, background: value as LeadFormFieldColor } })}>
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
  );
}
