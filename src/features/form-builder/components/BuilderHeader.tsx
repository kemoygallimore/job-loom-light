import { ArrowLeft, FileText, Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface BuilderHeaderProps {
  isEditing: boolean;
  dirty: boolean;
  saving: boolean;
  onLeave: () => void;
  onSave: () => void;
}

export function BuilderHeader({ isEditing, dirty, saving, onLeave, onSave }: BuilderHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="size-9" onClick={onLeave}>
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
        <Button variant="outline" type="button" onClick={onLeave}>
          Forms
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? "Saving..." : "Save form"}
        </Button>
      </div>
    </div>
  );
}
