import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Link2, Mail, Send } from "lucide-react";
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
import { htmlToPlainText } from "@/lib/htmlToPlainText";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import {
  CANDIDATE_EMAIL_PURPOSE_LABELS,
  CandidateEmailTemplate,
  CandidateEmailTemplatePurpose,
  REJECTION_TEMPLATE_KEY,
  appendCandidateEmailTokenToHtml,
  candidateEmailVariableToken,
  candidateEmailTemplateHasRequiredToken,
  insertCandidateEmailTokenInText,
  normalizeCandidateEmailTemplate,
  renderCandidateEmailTemplate,
  requiredTokenForCandidateEmailPurpose,
  variablesForCandidateEmailPurpose,
} from "@/lib/candidateEmailTemplates";

export interface CandidateEmailRecipient {
  candidateId: string;
  applicationId?: string | null;
  candidateName: string;
  candidateEmail: string | null;
  jobId?: string | null;
  jobTitle?: string | null;
}

interface CandidateEmailComposerProps {
  open: boolean;
  recipients: CandidateEmailRecipient[];
  onOpenChange: (open: boolean) => void;
  onSent?: (recipientApplicationIds: string[]) => void;
  mode?: "general" | "rejection";
  purpose?: CandidateEmailTemplatePurpose;
}

interface FunctionResult {
  sent?: number;
  failed?: number;
  rejected?: number;
  skipped_invalid_email?: number;
}

interface LeadFormOption {
  id: string;
  title: string;
  public_id: string;
  status: string;
}

interface ScreeningJobOption {
  id: string;
  title: string;
  job_id: string | null;
  unique_link_id: string;
  expires_at: string;
}

type QueryError = { message: string } | null;
type QueryResult<T> = { data: T[] | null; error: QueryError };
type QueryBuilder<T> = PromiseLike<QueryResult<T>> & {
  eq: (column: string, value: unknown) => QueryBuilder<T>;
  is: (column: string, value: unknown) => QueryBuilder<T>;
  order: (column: string, options?: Record<string, unknown>) => QueryBuilder<T>;
};
type UntypedDb = {
  from: <T>(table: string) => {
    select: (columns: string) => QueryBuilder<T>;
  };
};

const untypedDb = supabase as unknown as UntypedDb;

function isValidEmail(email: string | null | undefined) {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function CandidateEmailComposer({
  open,
  recipients,
  onOpenChange,
  onSent,
  mode = "general",
  purpose,
}: CandidateEmailComposerProps) {
  const { profile } = useAuth();
  const activePurpose = purpose ?? (mode === "rejection" ? "rejection" : "general");
  const [templates, setTemplates] = useState<CandidateEmailTemplate[]>([]);
  const [fallbackTemplate, setFallbackTemplate] = useState<CandidateEmailTemplate | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [leadForms, setLeadForms] = useState<LeadFormOption[]>([]);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [screeningJobs, setScreeningJobs] = useState<ScreeningJobOption[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingLinkOptions, setLoadingLinkOptions] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement | null>(null);

  const validRecipients = useMemo(
    () => recipients.filter((recipient) => isValidEmail(recipient.candidateEmail)),
    [recipients],
  );
  const skippedInvalidCount = recipients.length - validRecipients.length;
  const firstRecipient = validRecipients[0] ?? recipients[0] ?? null;
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? fallbackTemplate;
  const isBulk = recipients.length > 1;
  const availableVariables = variablesForCandidateEmailPurpose(activePurpose);
  const requiredToken = requiredTokenForCandidateEmailPurpose(activePurpose);

  const loadTemplates = useCallback(async () => {
    if (!open || !profile?.company_id) return;
    setLoadingTemplates(true);

    const [templateResult, companyResult] = await Promise.all([
      supabase
        .from("email_templates")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("is_active", true)
        .is("archived_at", null)
        .eq("purpose", activePurpose)
        .order("is_default_for_purpose", { ascending: false })
        .order("name", { ascending: true }),
      supabase.from("companies").select("name").eq("id", profile.company_id).maybeSingle(),
    ]);

    setCompanyName(companyResult.data?.name ?? "");

    if (templateResult.error) {
      toast.error(templateResult.error.message);
      setTemplates([]);
      setFallbackTemplate(null);
      setLoadingTemplates(false);
      return;
    }

    const list = ((templateResult.data ?? []) as CandidateEmailTemplate[]).map(normalizeCandidateEmailTemplate);
    setTemplates(list);
    setFallbackTemplate(null);

    const preferred =
      activePurpose === "rejection"
        ? list.find((template) => template.is_default_for_purpose) ?? list.find((template) => template.key === REJECTION_TEMPLATE_KEY) ?? list[0]
        : list.find((template) => template.is_default_for_purpose) ?? list[0];

    if (preferred) {
      setSelectedTemplateId(preferred.id ?? "");
      setSubject(preferred.subject);
      setHtmlBody(preferred.html_body);
      setLoadingTemplates(false);
      return;
    }

    const { data: fallbackData, error: fallbackError } = await supabase
      .rpc("resolve_email_template", {
        _company_id: profile.company_id,
        _template_id: null,
        _template_key: null,
        _purpose: activePurpose,
        _include_inactive: false,
      })
      .maybeSingle();

    if (fallbackError) {
      toast.error(fallbackError.message);
      setSelectedTemplateId("");
      setSubject("");
      setHtmlBody("");
      setLoadingTemplates(false);
      return;
    }

    const fallback = fallbackData ? normalizeCandidateEmailTemplate(fallbackData as Partial<CandidateEmailTemplate>) : null;
    setFallbackTemplate(fallback);
    setSelectedTemplateId(fallback?.id ?? "");
    setSubject(fallback?.subject ?? "");
    setHtmlBody(fallback?.html_body ?? "");
    setLoadingTemplates(false);
  }, [activePurpose, open, profile?.company_id]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!open || !profile?.company_id) {
      setLeadForms([]);
      setSelectedFormId("");
      setScreeningJobs([]);
      return;
    }

    const loadLinkOptions = async () => {
      setLoadingLinkOptions(true);
      if (activePurpose === "form_link") {
        const { data, error } = await untypedDb
          .from<LeadFormOption>("lead_forms")
          .select("id, title, public_id, status")
          .eq("company_id", profile.company_id)
          .eq("status", "active")
          .is("deleted_at", null)
          .order("title", { ascending: true });

        if (error) toast.error(error.message);
        const forms = data ?? [];
        setLeadForms(forms);
        setSelectedFormId((current) => (current && forms.some((form) => form.id === current) ? current : forms[0]?.id ?? ""));
      } else {
        setLeadForms([]);
        setSelectedFormId("");
      }

      if (activePurpose === "video_screening") {
        const { data, error } = await supabase
          .from("screening_jobs")
          .select("id, title, job_id, unique_link_id, expires_at")
          .eq("company_id", profile.company_id)
          .order("expires_at", { ascending: true });

        if (error) toast.error(error.message);
        const now = Date.now();
        setScreeningJobs(((data ?? []) as ScreeningJobOption[]).filter((job) => new Date(job.expires_at).getTime() > now));
      } else {
        setScreeningJobs([]);
      }

      setLoadingLinkOptions(false);
    };

    loadLinkOptions();
  }, [activePurpose, open, profile?.company_id]);

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
    form_link: leadForms.find((form) => form.id === selectedFormId)?.public_id
      ? `${window.location.origin}/forms/${leadForms.find((form) => form.id === selectedFormId)?.public_id}`
      : "{{form_link}}",
    screening_link: "{{screening_link}}",
  };

  const screeningResolution = useMemo(() => {
    if (activePurpose !== "video_screening") return { ok: true, linksByApplicationId: new Map<string, string>() };
    const linksByApplicationId = new Map<string, string>();

    for (const recipient of validRecipients) {
      if (!recipient.applicationId || !recipient.jobId) {
        return { ok: false, error: "Video screening links require selected candidates with job-matched applications.", linksByApplicationId };
      }

      const matches = screeningJobs.filter((job) => job.job_id === recipient.jobId);
      if (matches.length === 0) {
        return { ok: false, error: `${recipient.candidateName} does not have an active screening link for ${recipient.jobTitle ?? "their job"}.`, linksByApplicationId };
      }
      if (matches.length > 1) {
        return { ok: false, error: `${recipient.candidateName} has more than one active screening link for ${recipient.jobTitle ?? "their job"}.`, linksByApplicationId };
      }
      linksByApplicationId.set(recipient.applicationId, `${window.location.origin}/screen/${matches[0].unique_link_id}`);
    }

    return { ok: true, linksByApplicationId };
  }, [activePurpose, screeningJobs, validRecipients]);

  if (activePurpose === "video_screening" && firstRecipient?.applicationId) {
    previewVariables.screening_link = screeningResolution.linksByApplicationId.get(firstRecipient.applicationId) ?? "{{screening_link}}";
  }

  const renderedSubject = renderCandidateEmailTemplate(subject, previewVariables);
  const renderedHtml = sanitizeRichHtml(renderCandidateEmailTemplate(htmlBody, previewVariables));
  const selectedDraft = selectedTemplate
    ? { ...selectedTemplate, subject, html_body: htmlBody, purpose: activePurpose }
    : null;
  const templateMissingRequiredToken = !!selectedDraft && !candidateEmailTemplateHasRequiredToken(selectedDraft);
  const formLinkBlocked = activePurpose === "form_link" && leadForms.length === 0;
  const canSend =
    !sending &&
    !loadingTemplates &&
    !loadingLinkOptions &&
    !!selectedTemplate &&
    !!subject.trim() &&
    !!htmlBody.trim() &&
    validRecipients.length > 0 &&
    !templateMissingRequiredToken &&
    !(activePurpose === "form_link" && !selectedFormId) &&
    !(activePurpose === "video_screening" && !screeningResolution.ok);

  const send = async () => {
    if (!selectedTemplate || validRecipients.length === 0 || sending || !canSend) return;
    setSending(true);

    const { data, error } = await supabase.functions.invoke("send-candidate-email", {
      body: {
        mode: "candidate_email",
        template_id: selectedTemplate.company_id ? selectedTemplate.id : null,
        purpose: activePurpose,
        form_id: activePurpose === "form_link" ? selectedFormId : null,
        recipients: recipients.map((recipient) => ({
          candidate_id: recipient.candidateId,
          application_id: recipient.applicationId ?? null,
        })),
        subject,
        html_body: htmlBody,
        text_body: htmlToPlainText(htmlBody),
        reject_applications: activePurpose === "rejection",
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

    toast.success(activePurpose === "rejection" ? "Rejection email processed" : "Candidate email sent", {
      description: details || undefined,
    });
    onSent?.(recipients.map((recipient) => recipient.applicationId).filter(Boolean) as string[]);
    onOpenChange(false);
  };

  const requestSend = () => {
    if (!canSend) return;
    if (isBulk) {
      setConfirmOpen(true);
      return;
    }
    send();
  };

  const title = activePurpose === "rejection" ? "Review rejection email" : `${CANDIDATE_EMAIL_PURPOSE_LABELS[activePurpose]} email`;
  const description =
    activePurpose === "rejection"
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
                        {template.name}{template.is_default_for_purpose ? " (Default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates.length === 0 && fallbackTemplate && !loadingTemplates && (
                  <p className="text-xs text-muted-foreground">
                    Using the platform fallback template for this send.
                  </p>
                )}
                {templates.length === 0 && !fallbackTemplate && !loadingTemplates && (
                  <p className="text-xs text-destructive">
                    Create an active {CANDIDATE_EMAIL_PURPOSE_LABELS[activePurpose].toLowerCase()} template before sending this email.
                  </p>
                )}
              </div>

              {activePurpose === "form_link" && (
                <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                  <Label>Lead form</Label>
                  <Select value={selectedFormId} onValueChange={setSelectedFormId} disabled={loadingLinkOptions || leadForms.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingLinkOptions ? "Loading forms..." : "Select a form"} />
                    </SelectTrigger>
                    <SelectContent>
                      {leadForms.map((form) => (
                        <SelectItem key={form.id} value={form.id}>
                          {form.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formLinkBlocked && !loadingLinkOptions && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" />
                      No active lead forms are available.
                    </p>
                  )}
                </div>
              )}

              {activePurpose === "video_screening" && !loadingLinkOptions && !screeningResolution.ok && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  <span>{screeningResolution.error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="candidate-email-subject">Subject</Label>
                <Input
                  id="candidate-email-subject"
                  ref={subjectInputRef}
                  value={subject}
                  disabled={loadingTemplates}
                  onChange={(event) => setSubject(event.target.value)}
                />
                <VariableChips variables={availableVariables} onInsert={(variable) => insertSubjectToken(candidateEmailVariableToken(variable))} />
              </div>

              <div className="space-y-2">
                <Label>Email body</Label>
                <RichTextEditor value={htmlBody} onChange={setHtmlBody} placeholder="Write the candidate email..." />
                <VariableChips variables={availableVariables} onInsert={(variable) => insertBodyToken(candidateEmailVariableToken(variable))} />
                {requiredToken && (
                  <p className={templateMissingRequiredToken ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                    {templateMissingRequiredToken
                      ? `${requiredToken} is required before this ${CANDIDATE_EMAIL_PURPOSE_LABELS[activePurpose].toLowerCase()} email can be sent.`
                      : `This email includes the required ${requiredToken} variable.`}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <div>
                <h3 className="text-sm font-semibold">Preview</h3>
                <p className="mt-1 text-sm font-medium">{renderedSubject || "Select a template to preview"}</p>
              </div>
              {(activePurpose === "form_link" || activePurpose === "video_screening") && (
                <div className="flex items-center gap-2 rounded-md border bg-background p-3 text-xs text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5" />
                  <span>{activePurpose === "form_link" ? previewVariables.form_link : previewVariables.screening_link}</span>
                </div>
              )}
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
              disabled={!canSend}
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
