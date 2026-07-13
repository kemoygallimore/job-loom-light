import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FormBuilderAccessError({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">Forms unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button type="button" className="mt-4" onClick={onBack}>
          Back to forms
        </Button>
      </div>
    </div>
  );
}

export function FormBuilderLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  );
}
