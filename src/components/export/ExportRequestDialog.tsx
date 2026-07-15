import { useState, type ReactNode } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  exportTypeLabel,
  normalizeFullDatasetFilters,
  requestExport,
  type ExportFilters,
  type ExportScope,
  type ExportType,
} from "@/lib/exportJobs";

type Props = {
  exportType: ExportType;
  filters: ExportFilters;
  disabled?: boolean;
  trigger?: ReactNode;
  onRequested?: () => void;
};

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function ExportRequestDialog({ exportType, filters, disabled, trigger, onRequested }: Props) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<ExportScope>("current_view");
  const [requesting, setRequesting] = useState(false);
  const label = exportTypeLabel(exportType);

  const submit = async () => {
    setRequesting(true);
    try {
      const result = await requestExport({
        export_type: exportType,
        scope,
        filters: scope === "full_dataset" ? normalizeFullDatasetFilters(exportType, filters) : filters,
      });

      if (result.warning) toast.warning(result.warning);
      toast.success(`Export queued for ${result.job.row_count.toLocaleString()} row${result.job.row_count === 1 ? "" : "s"}`);
      setOpen(false);
      onRequested?.();
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not request export"));
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !requesting && setOpen(next)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" disabled={disabled}>
            <FileDown />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export {label}</DialogTitle>
          <DialogDescription>
            Excel files are generated in the background and stay available in Export Center for 7 days.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={scope} onValueChange={(value) => setScope(value as ExportScope)} className="grid gap-3">
          <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
            <RadioGroupItem value="current_view" className="mt-0.5" />
            <span>
              <span className="block font-medium">Current filters</span>
              <span className="block text-sm font-normal text-muted-foreground">
                Export the dataset matching this page's current filter state.
              </span>
            </span>
          </Label>
          <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
            <RadioGroupItem value="full_dataset" className="mt-0.5" />
            <span>
              <span className="block font-medium">Full dataset</span>
              <span className="block text-sm font-normal text-muted-foreground">
                Ignore optional filters for this export. Context such as the selected form or pipeline job is retained.
              </span>
            </span>
          </Label>
        </RadioGroup>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={requesting}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={requesting}>
            {requesting && <Loader2 className="animate-spin" />}
            Request export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
