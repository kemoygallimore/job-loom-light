import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FIELD_TYPE_LABELS, FIELD_TYPES, type LeadFormFieldType } from "@/lib/leadForms";

export function FieldPalette({ onAddField }: { onAddField: (type: LeadFormFieldType) => void }) {
  return (
    <aside className="rounded-lg border bg-card p-3">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Field palette</h2>
        <p className="text-xs text-muted-foreground">Add fields to the canvas.</p>
      </div>
      <div className="grid gap-2">
        {FIELD_TYPES.map((type) => (
          <Button key={type} type="button" variant="outline" className="justify-start" onClick={() => onAddField(type)}>
            <Plus className="size-4" />
            {FIELD_TYPE_LABELS[type]}
          </Button>
        ))}
      </div>
    </aside>
  );
}
