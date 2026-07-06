import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Mail, Plus, Save } from "lucide-react";
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
    if (draft.is_default_for_purpose) {
      const { error: defaultError } = await supabase
        .from("company_email_templates")
        .update({ is_default_for_purpose: false })
        .eq("company_id", profile.company_id)
        .eq("purpose", draft.purpose);

      if (defaultError) {
        setSaving(false);
        toast.error(defaultError.message);
        return;
      }
    }

    const payload = {
      company_id: profile.company_id,
      key: draft.key,
      name: draft.name.trim(),
      purpose: draft.purpose,
      is_default_for_purpose: draft.is_default_for_purpose,
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
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const saved = normalizeCandidateEmailTemplate(data as CandidateEmailTemplate);
    setTemplates((current) => {
      const withoutSaved = current.filter((template) => template.id !== saved.id);
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <Card className="h-fit p-2">
          {templates.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No saved templates yet.</p>
          ) : (
            templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedId(template.id ?? null)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                  selectedId === template.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                )}
              >
                <div className="font-medium">{template.name}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{template.subject}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                  <span>{CANDIDATE_EMAIL_PURPOSE_LABELS[template.purpose]}</span>
                  {template.is_default_for_purpose && <span>Default</span>}
                </div>
                {!template.is_active && <div className="mt-0.5 text-xs text-destructive">Inactive</div>}
              </button>
            ))
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
            {requiredTokenForCandidateEmailPurpose(draft.purpose) && (
              <p className="text-xs text-muted-foreground">
                This purpose requires {requiredTokenForCandidateEmailPurpose(draft.purpose)} in the subject or body.
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
