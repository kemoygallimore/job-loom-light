import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FIELD_TYPE_LABELS, FIELD_TYPES, type LeadFormFieldType } from "@/lib/leadForms";
import { cn } from "@/lib/utils";

interface FieldPaletteProps {
  className?: string;
  onAddField: (type: LeadFormFieldType) => void;
}

export function FieldPalette({ className, onAddField }: FieldPaletteProps) {
  return (
    <aside aria-label="Field palette" className={cn("rounded-lg border bg-card p-3", className)}>
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
