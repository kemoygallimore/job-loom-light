import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/RichTextEditor";
import { VariableChips } from "@/components/email/VariableChips";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import {
  CANDIDATE_EMAIL_VARIABLES,
  CandidateEmailTemplate,
  REJECTION_TEMPLATE_KEY,
  appendCandidateEmailTokenToHtml,
  candidateEmailVariableToken,
  insertCandidateEmailTokenInText,
  normalizeCandidateEmailTemplate,
  renderCandidateEmailTemplate,
} from "@/lib/candidateEmailTemplates";

export interface CandidateEmailRecipient {
  candidateId: string;
  applicationId?: string | null;
  candidateName: string;
  candidateEmail: string | null;
  jobTitle?: string | null;
}

interface CandidateEmailComposerProps {
  open: boolean;
  recipients: CandidateEmailRecipient[];
  onOpenChange: (open: boolean) => void;
  onSent?: (recipientApplicationIds: string[]) => void;
  mode?: "general" | "rejection";
}

interface FunctionResult {
  sent?: number;
  failed?: number;
  rejected?: number;
  skipped_invalid_email?: number;
}

function isValidEmail(email: string | null | undefined) {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function CandidateEmailComposer({
  open,
  recipients,
  onOpenChange,
  onSent,
  mode = "general",
}: CandidateEmailComposerProps) {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<CandidateEmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement | null>(null);

  const validRecipients = useMemo(
    () => recipients.filter((recipient) => isValidEmail(recipient.candidateEmail)),
    [recipients],
  );
  const skippedInvalidCount = recipients.length - validRecipients.length;
  const firstRecipient = validRecipients[0] ?? recipients[0] ?? null;
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const isBulk = recipients.length > 1;

  const loadTemplates = useCallback(async () => {
    if (!open || !profile?.company_id) return;
    setLoadingTemplates(true);

    const [templateResult, companyResult] = await Promise.all([
      supabase
        .from("company_email_templates")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("is_active", true)
        .is("archived_at", null)
        .order("name", { ascending: true }),
      supabase.from("companies").select("name").eq("id", profile.company_id).maybeSingle(),
    ]);

    setCompanyName(companyResult.data?.name ?? "");

    if (templateResult.error) {
      toast.error(templateResult.error.message);
      setTemplates([]);
      setLoadingTemplates(false);
      return;
    }

    const list = ((templateResult.data ?? []) as CandidateEmailTemplate[]).map(normalizeCandidateEmailTemplate);
    setTemplates(list);

    const preferred =
      mode === "rejection"
        ? list.find((template) => template.key === REJECTION_TEMPLATE_KEY) ?? list[0]
        : list[0];

    setSelectedTemplateId(preferred?.id ?? "");
    setSubject(preferred?.subject ?? "");
    setHtmlBody(preferred?.html_body ?? "");
    setLoadingTemplates(false);
  }, [mode, open, profile?.company_id]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    setSelectedTemplateId(templateId);
    setSubject(template?.subject ?? "");
    setHtmlBody(template?.html_body ?? "");
  };

  const insertSubjectToken = (token: string) => {
    const input = subjectInputRef.current;
    const nextSubject = insertCandidateEmailTokenInText(subject, token, input?.selectionStart, input?.selectionEnd);
    setSubject(nextSubject);

    window.requestAnimationFrame(() => {
      input?.focus();
      const nextCursor = (input?.selectionStart ?? nextSubject.length) + token.length;
      input?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const insertBodyToken = (token: string) => {
    setHtmlBody((current) => appendCandidateEmailTokenToHtml(current, token));
  };

  const previewVariables = {
    candidate_name: firstRecipient?.candidateName || "Candidate",
    company_name: companyName || "your company",
    job_title: firstRecipient?.jobTitle || "the role",
  };
  const renderedSubject = renderCandidateEmailTemplate(subject, previewVariables);
  const renderedHtml = sanitizeRichHtml(renderCandidateEmailTemplate(htmlBody, previewVariables));

  const send = async () => {
    if (!selectedTemplate || validRecipients.length === 0 || sending) return;
    setSending(true);

    const { data, error } = await supabase.functions.invoke("send-candidate-email", {
      body: {
        mode: "candidate_email",
        template_id: selectedTemplate.id,
        recipients: recipients.map((recipient) => ({
          candidate_id: recipient.candidateId,
          application_id: recipient.applicationId ?? null,
        })),
        subject,
        html_body: htmlBody,
        text_body: selectedTemplate.text_body,
        reject_applications: mode === "rejection",
      },
    });

    setSending(false);
    setConfirmOpen(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const result = (data ?? {}) as FunctionResult;
    const sent = result.sent ?? 0;
    const failed = result.failed ?? 0;
    const skipped = result.skipped_invalid_email ?? skippedInvalidCount;
    const details = [
      `${sent} sent`,
      failed > 0 ? `${failed} failed` : null,
      skipped > 0 ? `${skipped} skipped` : null,
    ].filter(Boolean).join(", ");

    toast.success(mode === "rejection" ? "Rejection email processed" : "Candidate email sent", {
      description: details || undefined,
    });
    onSent?.(recipients.map((recipient) => recipient.applicationId).filter(Boolean) as string[]);
    onOpenChange(false);
  };

  const requestSend = () => {
    if (isBulk) {
      setConfirmOpen(true);
      return;
    }
    send();
  };

  const title = mode === "rejection" ? "Review rejection email" : "Email candidate";
  const description =
    mode === "rejection"
      ? `${recipients.length} candidate${recipients.length === 1 ? "" : "s"} will be moved to rejected.`
      : `${recipients.length} candidate${recipients.length === 1 ? "" : "s"} selected.`;

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !sending && onOpenChange(nextOpen)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto" onClick={(event) => event.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={selectedTemplateId} onValueChange={handleTemplateChange} disabled={loadingTemplates}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingTemplates ? "Loading templates..." : "Select a template"} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id ?? ""}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates.length === 0 && !loadingTemplates && (
                  <p className="text-xs text-destructive">Create an active email template before sending.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="candidate-email-subject">Subject</Label>
                <Input
                  id="candidate-email-subject"
                  ref={subjectInputRef}
                  value={subject}
                  disabled={loadingTemplates}
                  onChange={(event) => setSubject(event.target.value)}
                />
                <VariableChips variables={[...CANDIDATE_EMAIL_VARIABLES]} onInsert={(variable) => insertSubjectToken(candidateEmailVariableToken(variable))} />
              </div>

              <div className="space-y-2">
                <Label>Email body</Label>
                <RichTextEditor value={htmlBody} onChange={setHtmlBody} placeholder="Write the candidate email..." />
                <VariableChips variables={[...CANDIDATE_EMAIL_VARIABLES]} onInsert={(variable) => insertBodyToken(candidateEmailVariableToken(variable))} />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <div>
                <h3 className="text-sm font-semibold">Preview</h3>
                <p className="mt-1 text-sm font-medium">{renderedSubject || "Select a template to preview"}</p>
              </div>
              <div
                className="prose prose-sm max-w-none rounded-md border bg-background p-4"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
              <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
                <div>{validRecipients.length} valid recipient{validRecipients.length === 1 ? "" : "s"}</div>
                {skippedInvalidCount > 0 && <div>{skippedInvalidCount} missing or invalid email{skippedInvalidCount === 1 ? "" : "s"} will be skipped</div>}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={requestSend}
              disabled={sending || loadingTemplates || !selectedTemplateId || !subject.trim() || !htmlBody.trim() || validRecipients.length === 0}
            >
              <Send className="mr-2 h-4 w-4" />
              {sending ? "Sending..." : isBulk ? "Review send" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm bulk email</AlertDialogTitle>
            <AlertDialogDescription>
              Send "{selectedTemplate?.name}" to {validRecipients.length} candidate{validRecipients.length === 1 ? "" : "s"}.
              {skippedInvalidCount > 0 ? ` ${skippedInvalidCount} selected candidate${skippedInvalidCount === 1 ? "" : "s"} will be skipped.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-sm font-medium">{renderedSubject}</p>
            <div className="prose prose-sm mt-2 max-h-48 max-w-none overflow-y-auto" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={send} disabled={sending}>
              {sending ? "Sending..." : "Send emails"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
