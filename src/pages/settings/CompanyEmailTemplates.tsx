import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, CheckCircle2, Mail, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/RichTextEditor";
import { VariableChips } from "@/components/email/VariableChips";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import {
  CANDIDATE_EMAIL_PURPOSE_LABELS,
  CANDIDATE_EMAIL_PURPOSES,
  CandidateEmailTemplate,
  appendCandidateEmailTokenToHtml,
  candidateEmailVariableToken,
  candidateEmailTemplateHasRequiredToken,
  defaultCandidateEmailTemplate,
  insertCandidateEmailTokenInText,
  normalizeCandidateEmailTemplate,
  renderCandidateEmailTemplate,
  requiredTokenForCandidateEmailPurpose,
  SAMPLE_CANDIDATE_EMAIL_VARIABLES,
  SAMPLE_LINK_EMAIL_VARIABLES,
  variablesForCandidateEmailPurpose,
} from "@/lib/candidateEmailTemplates";
import { cn } from "@/lib/utils";

export default function CompanyEmailTemplates() {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<CandidateEmailTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CandidateEmailTemplate | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [selectedId, templates],
  );
  const templatesByPurpose = useMemo(
    () =>
      CANDIDATE_EMAIL_PURPOSES.map((purpose) => ({
        purpose,
        templates: templates.filter((template) => template.purpose === purpose),
      })),
    [templates],
  );

  const loadTemplates = useCallback(async () => {
    if (!profile?.company_id) {
      setTemplates([]);
      setDraft(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [templateResult, companyResult] = await Promise.all([
      supabase
        .from("company_email_templates")
        .select("*")
        .eq("company_id", profile.company_id)
        .is("archived_at", null)
        .order("is_active", { ascending: false })
        .order("name", { ascending: true }),
      supabase
        .from("companies")
        .select("name")
        .eq("id", profile.company_id)
        .maybeSingle(),
    ]);

    setCompanyName(companyResult.data?.name ?? "");

    if (templateResult.error) {
      toast.error(templateResult.error.message);
      setTemplates([]);
      setDraft(defaultCandidateEmailTemplate(profile.company_id));
      setLoading(false);
      return;
    }

    const list = ((templateResult.data ?? []) as CandidateEmailTemplate[]).map(normalizeCandidateEmailTemplate);
    setTemplates(list);
    setSelectedId((current) => (current && list.some((template) => template.id === current) ? current : list[0]?.id ?? null));
    setDraft(list[0] ?? defaultCandidateEmailTemplate(profile.company_id));
    setLoading(false);
  }, [profile?.company_id]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (selectedTemplate) setDraft(selectedTemplate);
  }, [selectedTemplate]);

  const startNewTemplate = () => {
    if (!profile?.company_id) return;
    setSelectedId(null);
    setDraft(defaultCandidateEmailTemplate(profile.company_id));
  };

  const insertSubjectToken = (token: string) => {
    if (!draft) return;
    const input = subjectInputRef.current;
    const nextSubject = insertCandidateEmailTokenInText(
      draft.subject,
      token,
      input?.selectionStart,
      input?.selectionEnd,
    );
    setDraft({ ...draft, subject: nextSubject });

    window.requestAnimationFrame(() => {
      input?.focus();
      const nextCursor = (input?.selectionStart ?? nextSubject.length) + token.length;
      input?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const insertBodyToken = (token: string) => {
    if (!draft) return;
    setDraft({ ...draft, html_body: appendCandidateEmailTokenToHtml(draft.html_body, token) });
  };

  const save = async () => {
    if (!draft || !profile?.company_id) return;
    if (!draft.name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (!draft.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!draft.html_body.trim()) {
      toast.error("Email body is required");
      return;
    }
    const requiredToken = requiredTokenForCandidateEmailPurpose(draft.purpose);
    if (requiredToken && !candidateEmailTemplateHasRequiredToken(draft)) {
      toast.error(`${CANDIDATE_EMAIL_PURPOSE_LABELS[draft.purpose]} templates must include ${requiredToken}`);
      return;
    }

    setSaving(true);
    const shouldBecomeDefault = draft.is_default_for_purpose;
    const previousDefaultIds = templates
      .filter((template) => template.purpose === draft.purpose && template.is_default_for_purpose && template.id !== draft.id)
      .map((template) => template.id)
      .filter(Boolean) as string[];

    const payload = {
      company_id: profile.company_id,
      key: draft.key,
      name: draft.name.trim(),
      purpose: draft.purpose,
      is_default_for_purpose: shouldBecomeDefault && previousDefaultIds.length === 0,
      subject: draft.subject,
      html_body: draft.html_body,
      text_body: draft.text_body,
      variables: variablesForCandidateEmailPurpose(draft.purpose),
      is_active: draft.is_active,
      archived_at: null,
      updated_by: profile.user_id,
    };

    const query = draft.id
      ? supabase.from("company_email_templates").update(payload).eq("id", draft.id).select("*").single()
      : supabase.from("company_email_templates").insert(payload).select("*").single();

    const { data, error } = await query;

    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    let saved = normalizeCandidateEmailTemplate(data as CandidateEmailTemplate);

    if (shouldBecomeDefault && previousDefaultIds.length > 0 && saved.id) {
      const { error: clearDefaultError } = await supabase
        .from("company_email_templates")
        .update({ is_default_for_purpose: false })
        .eq("company_id", profile.company_id)
        .eq("purpose", draft.purpose);

      if (clearDefaultError) {
        setSaving(false);
        toast.error(clearDefaultError.message);
        return;
      }

      const { data: defaultData, error: setDefaultError } = await supabase
        .from("company_email_templates")
        .update({ is_default_for_purpose: true })
        .eq("id", saved.id)
        .eq("company_id", profile.company_id)
        .select("*")
        .single();

      if (setDefaultError) {
        await supabase
          .from("company_email_templates")
          .update({ is_default_for_purpose: true })
          .in("id", previousDefaultIds);
        setSaving(false);
        toast.error(setDefaultError.message);
        return;
      }

      saved = normalizeCandidateEmailTemplate(defaultData as CandidateEmailTemplate);
    }

    setSaving(false);
    setTemplates((current) => {
      const withoutSaved = current
        .filter((template) => template.id !== saved.id)
        .map((template) =>
          shouldBecomeDefault && template.purpose === saved.purpose
            ? { ...template, is_default_for_purpose: false }
            : template,
        );
      return [...withoutSaved, saved].sort((left, right) => {
        if (left.is_active !== right.is_active) return left.is_active ? -1 : 1;
        if (left.purpose !== right.purpose) return left.purpose.localeCompare(right.purpose);
        return left.name.localeCompare(right.name);
      });
    });
    setSelectedId(saved.id ?? null);
    setDraft(saved);
    toast.success("Email template saved");
  };

  const archiveTemplate = async () => {
    if (!draft?.id) return;
    const { error } = await supabase
      .from("company_email_templates")
      .update({ archived_at: new Date().toISOString(), is_active: false, updated_by: profile?.user_id })
      .eq("id", draft.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    const remaining = templates.filter((template) => template.id !== draft.id);
    setTemplates(remaining);
    setSelectedId(remaining[0]?.id ?? null);
    setDraft(remaining[0] ?? (profile?.company_id ? defaultCandidateEmailTemplate(profile.company_id) : null));
    toast.success("Template archived");
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (!draft) {
    return <div className="text-sm text-muted-foreground">Templates unavailable.</div>;
  }

  const previewVariables = {
    ...SAMPLE_CANDIDATE_EMAIL_VARIABLES,
    ...SAMPLE_LINK_EMAIL_VARIABLES,
    company_name: companyName || SAMPLE_CANDIDATE_EMAIL_VARIABLES.company_name,
  };
  const renderedSubject = renderCandidateEmailTemplate(draft.subject, previewVariables);
  const renderedHtml = sanitizeRichHtml(renderCandidateEmailTemplate(draft.html_body, previewVariables));
  const draftVariables = variablesForCandidateEmailPurpose(draft.purpose);
  const requiredToken = requiredTokenForCandidateEmailPurpose(draft.purpose);
  const missingRequiredToken = Boolean(requiredToken && !candidateEmailTemplateHasRequiredToken(draft));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Email Templates</h1>
            <p className="text-sm text-muted-foreground">Reusable candidate emails for your team.</p>
          </div>
        </div>
        <Button type="button" onClick={startNewTemplate}>
          <Plus className="mr-2 h-4 w-4" />
          New template
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <Card className="h-fit p-3">
          {templates.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No saved templates yet. Create a general template to start sending candidate emails.
            </div>
          ) : (
            <div className="space-y-4">
              {templatesByPurpose.map(({ purpose, templates: purposeTemplates }) => (
                <section key={purpose} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {CANDIDATE_EMAIL_PURPOSE_LABELS[purpose]}
                    </h2>
                    <span className="text-xs tabular-nums text-muted-foreground">{purposeTemplates.length}</span>
                  </div>
                  {purposeTemplates.length === 0 ? (
                    <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      No {CANDIDATE_EMAIL_PURPOSE_LABELS[purpose].toLowerCase()} templates.
                    </div>
                  ) : (
                    purposeTemplates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setSelectedId(template.id ?? null)}
                        className={cn(
                          "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                          selectedId === template.id
                            ? "border-primary bg-primary/5 text-foreground shadow-sm"
                            : "border-transparent hover:border-border hover:bg-muted/50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{template.name}</div>
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">{template.subject}</div>
                          </div>
                          {template.is_default_for_purpose && <CheckCircle2 className="mt-0.5 size-4 flex-shrink-0 text-primary" />}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                          {template.is_default_for_purpose && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">Default</span>
                          )}
                          <span className={cn("rounded-full px-2 py-0.5", template.is_active ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground")}>
                            {template.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </section>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold">{draft.id ? "Edit template" : "New template"}</h2>
              <p className="text-sm text-muted-foreground">Templates are required when emailing candidates.</p>
            </div>
            <Label className="flex items-center gap-2 text-sm">
              Active
              <Switch checked={draft.is_active} onCheckedChange={(is_active) => setDraft({ ...draft, is_active })} />
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="candidate-template-name">Template name</Label>
            <Input
              id="candidate-template-name"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Interview invitation"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Purpose</Label>
              <Select
                value={draft.purpose}
                onValueChange={(purpose) => {
                  const nextPurpose = purpose as CandidateEmailTemplate["purpose"];
                  setDraft({
                    ...draft,
                    purpose: nextPurpose,
                    is_default_for_purpose: false,
                    variables: variablesForCandidateEmailPurpose(nextPurpose),
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANDIDATE_EMAIL_PURPOSES.map((purpose) => (
                    <SelectItem key={purpose} value={purpose}>
                      {CANDIDATE_EMAIL_PURPOSE_LABELS[purpose]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Label className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>
                <span className="block font-medium">Default for this purpose</span>
                <span className="block text-xs text-muted-foreground">Preselect this template for matching actions.</span>
              </span>
              <Switch
                checked={draft.is_default_for_purpose}
                onCheckedChange={(is_default_for_purpose) => setDraft({ ...draft, is_default_for_purpose })}
              />
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="candidate-template-subject">Subject</Label>
            <Input
              id="candidate-template-subject"
              ref={subjectInputRef}
              value={draft.subject}
              onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
            />
            <VariableChips variables={draftVariables} onInsert={(variable) => insertSubjectToken(candidateEmailVariableToken(variable))} />
          </div>

          <div className="space-y-2">
            <Label>Email body</Label>
            <RichTextEditor
              value={draft.html_body}
              onChange={(html_body) => setDraft({ ...draft, html_body })}
              placeholder="Write the candidate email..."
            />
            <VariableChips variables={draftVariables} onInsert={(variable) => insertBodyToken(candidateEmailVariableToken(variable))} />
            {requiredToken && (
              <p className={cn("text-xs", missingRequiredToken ? "text-destructive" : "text-muted-foreground")}>
                {missingRequiredToken
                  ? `${requiredToken} is required before this template can be used for ${CANDIDATE_EMAIL_PURPOSE_LABELS[draft.purpose].toLowerCase()} emails.`
                  : `This purpose includes ${requiredToken} in the message.`}
              </p>
            )}
          </div>

          <div className="flex flex-wrap justify-between gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={archiveTemplate} disabled={!draft.id}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </Card>

        <Card className="h-fit space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold">Preview</h2>
            <p className="mt-1 text-sm font-medium">{renderedSubject}</p>
          </div>
          <div
            className="prose prose-sm max-w-none rounded-md border bg-background p-4"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </Card>
      </div>
    </div>
  );
}
