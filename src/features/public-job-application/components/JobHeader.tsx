import { Building2 } from "lucide-react";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import type { CompanySummary, JobSummary } from "../types";

export function JobHeader({ job, company }: { job: JobSummary | null; company: CompanySummary | null }) {
  return (
    <header className="border-b bg-card">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-2xl font-bold tracking-tight">{job?.title}</h1>
        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
          <Building2 className="w-4 h-4" />
          {company?.name}
        </div>
        {job?.description && (
          <div
            className="prose prose-sm max-w-none mt-3 prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-a:text-primary"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(job.description) }}
          />
        )}
      </div>
    </header>
  );
}
