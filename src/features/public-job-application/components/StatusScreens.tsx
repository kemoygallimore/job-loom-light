import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { JobSummary } from "../types";

export function ApplicationLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-[3px] border-muted" />
          <div className="absolute inset-0 rounded-full border-[3px] border-t-primary animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

export function JobNotFoundScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <h1 className="text-xl font-semibold">This job is no longer available</h1>
        <p className="text-muted-foreground text-sm mt-2">
          The position may have been filled or the listing has been removed.
        </p>
      </div>
    </div>
  );
}

export function ApplicationSuccessScreen({ job }: { job: JobSummary | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center animate-fade-in">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold" data-testid="application-success-message">Application Submitted!</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
          Thank you for applying to <span className="font-medium text-foreground">{job?.title}</span>. We'll review
          your application and get back to you soon.
        </p>
      </div>
    </div>
  );
}
