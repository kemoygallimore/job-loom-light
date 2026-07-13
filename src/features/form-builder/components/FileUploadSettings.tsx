import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_FILE_CATEGORIES,
  DEFAULT_UPLOAD_MAX_MB,
  FILE_CATEGORY_OPTIONS,
  type LeadFormField,
} from "@/lib/leadForms";

export function FileUploadSettings({
  field,
  updateField,
}: {
  field: LeadFormField;
  updateField: (fieldId: string, patch: Partial<LeadFormField>) => void;
}) {
  return (
    <div className="rounded-lg border p-3">
      <h3 className="text-sm font-semibold">File upload</h3>
      <div className="mt-3 flex flex-col gap-2">
        <Label>Max size in MB</Label>
        <Input
          type="number"
          min={1}
          max={10}
          value={field.upload?.maxSizeMb ?? DEFAULT_UPLOAD_MAX_MB}
          onChange={(event) =>
            updateField(field.id, {
              upload: { ...field.upload, maxSizeMb: Number(event.target.value) || DEFAULT_UPLOAD_MAX_MB },
            })
          }
        />
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <Label>Allowed types</Label>
        {FILE_CATEGORY_OPTIONS.map((category) => {
          const selected = field.upload?.allowedCategories ?? DEFAULT_FILE_CATEGORIES;
          return (
            <label key={category.value} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Checkbox
                checked={selected.includes(category.value)}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...selected, category.value]
                    : selected.filter((item) => item !== category.value);
                  updateField(field.id, {
                    upload: {
                      ...field.upload,
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
  );
}
