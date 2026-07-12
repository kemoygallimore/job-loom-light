import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { answerPreview } from "@/lib/leadForms";
import type { LeadFormSubmission, LeadFormUpload } from "../types";

type Props = {
  submission: LeadFormSubmission | null;
  uploads: LeadFormUpload[];
  onOpenChange: (open: boolean) => void;
  onOpenUpload: (upload: LeadFormUpload) => void;
};

export function SubmissionDetailsDialog({ submission, uploads, onOpenChange, onOpenUpload }: Props) {
  return (
    <Dialog open={Boolean(submission)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submission details</DialogTitle>
        </DialogHeader>
        {submission && (
          <div className="flex flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {submission.schema_snapshot.fields
                .filter((field) => field.type !== "section")
                .map((field) => (
                  <div key={field.id} className="rounded-lg border bg-background p-3">
                    <div className="text-xs font-medium text-muted-foreground">{field.label}</div>
                    <div className="mt-1 text-sm">{answerPreview(submission.answers[field.id])}</div>
                  </div>
                ))}
            </div>
            {uploads.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Uploads</h3>
                {uploads.map((upload) => (
                  <div key={upload.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{upload.file_name}</div>
                      <div className="text-xs text-muted-foreground">{Math.ceil(upload.file_size / 1024)} KB</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => onOpenUpload(upload)}>
                      <Upload className="size-4" />
                      Open
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
