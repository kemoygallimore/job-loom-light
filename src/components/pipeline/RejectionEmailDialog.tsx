import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import { VariableChips } from "@/components/email/VariableChips";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import {
  appendTokenToHtml,
  DEFAULT_REJECTION_EMAIL_HTML,
  DEFAULT_REJECTION_EMAIL_SUBJECT,
  insertTokenInText,
  REJECTION_TEMPLATE_KEY,
  REJECTION_TEMPLATE_VARIABLES,
  renderTemplate,
} from "@/lib/rejectionEmailTemplate";
import type { Application } from "@/pages/Pipeline";

interface RejectionEmailDialogProps {
  open: boolean;
  applications: Application[];
  onOpenChange: (open: boolean) => void;
  onSent: (applicationIds: string[]) => void;
}

interface FunctionResult {
  rejected?: number;
  sent?: number;
  failed?: number;
  skipped_invalid_email?: number;
}

export function RejectionEmailDialog({ open, applications, onOpenChange, onSent }: RejectionEmailDialogProps) {
  const { profile } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [subject, setSubject] = useState(DEFAULT_REJECTION_EMAIL_SUBJECT);
  const [htmlBody, setHtmlBody] = useState(DEFAULT_REJECTION_EMAIL_HTML);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [sending, setSending] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement | null>(null);

  const applicationIds = useMemo(() => applications.map((app) => app.id), [applications]);
  const firstApplication = applications[0] ?? null;

  const loadTemplate = useCallback(async () => {
    if (!open || !profile?.company_id) return;
    setLoadingTemplate(true);

    const [templateResult, companyResult] = await Promise.all([
      supabase
        .from("company_email_templates")
        .select("subject, html_body")
        .eq("company_id", profile.company_id)
        .eq("key", REJECTION_TEMPLATE_KEY)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("companies")
        .select("name")
        .eq("id", profile.company_id)
        .maybeSingle(),
    ]);

    setCompanyName(companyResult.data?.name ?? "");

    if (templateResult.error) {
      toast.error(templateResult.error.message);
      setSubject(DEFAULT_REJECTION_EMAIL_SUBJECT);
      setHtmlBody(DEFAULT_REJECTION_EMAIL_HTML);
    } else {
      setSubject(templateResult.data?.subject ?? DEFAULT_REJECTION_EMAIL_SUBJECT);
      setHtmlBody(templateResult.data?.html_body ?? DEFAULT_REJECTION_EMAIL_HTML);
    }

    setLoadingTemplate(false);
  }, [open, profile?.company_id]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const insertSubjectToken = (token: string) => {
    const input = subjectInputRef.current;
    const start = input?.selectionStart;
    const nextSubject = insertTokenInText(subject, token, start, input?.selectionEnd);
    setSubject(nextSubject);

    window.requestAnimationFrame(() => {
      input?.focus();
      const nextCursor = (start ?? nextSubject.length) + token.length;
      input?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const insertBodyToken = (token: string) => {
    setHtmlBody((current) => appendTokenToHtml(current, token));
  };

  const previewVariables = {
    candidate_name: firstApplication?.candidate?.name || "Candidate",
    company_name: companyName || "your company",
    job_title: firstApplication?.job?.title || "the role",
  };
  const renderedSubject = renderTemplate(subject, previewVariables);
  const renderedHtml = sanitizeRichHtml(renderTemplate(htmlBody, previewVariables));

  const send = async () => {
    if (applicationIds.length === 0 || sending) return;
    setSending(true);

    const { data, error } = await supabase.functions.invoke("send-candidate-email", {
      body: {
        mode: "candidate_rejected",
        application_ids: applicationIds,
        subject,
        html_body: htmlBody,
        text_body: null,
      },
    });

    setSending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const result = (data ?? {}) as FunctionResult;
    const rejected = result.rejected ?? applicationIds.length;
    const sent = result.sent ?? 0;
    const failed = result.failed ?? 0;
    const skipped = result.skipped_invalid_email ?? 0;
    const details = [
      `${sent} email${sent === 1 ? "" : "s"} sent`,
      failed > 0 ? `${failed} failed` : null,
      skipped > 0 ? `${skipped} skipped` : null,
    ].filter(Boolean).join(", ");

    toast.success(`Rejected ${rejected} candidate${rejected === 1 ? "" : "s"}`, {
      description: details || undefined,
    });
    onSent(applicationIds);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !sending && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Review rejection email
          </DialogTitle>
          <DialogDescription>
            {applications.length} candidate{applications.length === 1 ? "" : "s"} will be moved to rejected.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reject-email-subject">Subject</Label>
              <Input
                id="reject-email-subject"
                ref={subjectInputRef}
                value={subject}
                disabled={loadingTemplate}
                onChange={(event) => setSubject(event.target.value)}
              />
              <VariableChips variables={REJECTION_TEMPLATE_VARIABLES} onInsert={insertSubjectToken} />
            </div>

            <div className="space-y-2">
              <Label>Email Body</Label>
              <RichTextEditor
                value={htmlBody}
                onChange={setHtmlBody}
                placeholder="Write the rejection email..."
              />
              <VariableChips variables={REJECTION_TEMPLATE_VARIABLES} onInsert={insertBodyToken} />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div>
              <h3 className="text-sm font-semibold">Preview</h3>
              <p className="mt-1 text-sm font-medium">{renderedSubject}</p>
            </div>
            <div
              className="prose prose-sm max-w-none rounded-md border bg-background p-4"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button type="button" onClick={send} disabled={sending || loadingTemplate || applicationIds.length === 0}>
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
