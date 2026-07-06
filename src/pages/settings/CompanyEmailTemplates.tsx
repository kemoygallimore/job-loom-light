import { useCallback, useEffect, useRef, useState } from "react";
import { Mail, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import { VariableChips } from "@/components/email/VariableChips";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import {
  appendTokenToHtml,
  DEFAULT_REJECTION_EMAIL_HTML,
  DEFAULT_REJECTION_EMAIL_SUBJECT,
  DEFAULT_REJECTION_EMAIL_TEXT,
  DEFAULT_REJECTION_TEMPLATE_NAME,
  insertTokenInText,
  REJECTION_TEMPLATE_KEY,
  REJECTION_TEMPLATE_VARIABLES,
  renderTemplate,
  SAMPLE_REJECTION_VARIABLES,
} from "@/lib/rejectionEmailTemplate";

interface CompanyEmailTemplate {
  id?: string;
  company_id: string;
  key: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  variables: string[];
  is_active: boolean;
}

function defaultTemplate(companyId: string): CompanyEmailTemplate {
  return {
    company_id: companyId,
    key: REJECTION_TEMPLATE_KEY,
    name: DEFAULT_REJECTION_TEMPLATE_NAME,
    subject: DEFAULT_REJECTION_EMAIL_SUBJECT,
    html_body: DEFAULT_REJECTION_EMAIL_HTML,
    text_body: DEFAULT_REJECTION_EMAIL_TEXT,
    variables: [...REJECTION_TEMPLATE_VARIABLES],
    is_active: true,
  };
}

export default function CompanyEmailTemplates() {
  const { profile } = useAuth();
  const [template, setTemplate] = useState<CompanyEmailTemplate | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement | null>(null);

  const loadTemplate = useCallback(async () => {
    if (!profile?.company_id) {
      setTemplate(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    const [templateResult, companyResult] = await Promise.all([
      supabase
        .from("company_email_templates")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("key", REJECTION_TEMPLATE_KEY)
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
      setTemplate(defaultTemplate(profile.company_id));
      setLoading(false);
      return;
    }

    setTemplate(templateResult.data ? {
      ...templateResult.data,
      variables: Array.isArray(templateResult.data.variables)
        ? templateResult.data.variables
        : [...REJECTION_TEMPLATE_VARIABLES],
    } : defaultTemplate(profile.company_id));
    setLoading(false);
  }, [profile?.company_id]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const insertSubjectToken = (token: string) => {
    if (!template) return;
    const input = subjectInputRef.current;
    const nextSubject = insertTokenInText(
      template.subject,
      token,
      input?.selectionStart,
      input?.selectionEnd,
    );
    setTemplate({ ...template, subject: nextSubject });

    window.requestAnimationFrame(() => {
      input?.focus();
      const nextCursor = (input?.selectionStart ?? nextSubject.length) + token.length;
      input?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const insertBodyToken = (token: string) => {
    if (!template) return;
    setTemplate({ ...template, html_body: appendTokenToHtml(template.html_body, token) });
  };

  const save = async () => {
    if (!template || !profile?.company_id) return;
    setSaving(true);

    const payload = {
      company_id: profile.company_id,
      key: REJECTION_TEMPLATE_KEY,
      name: template.name || DEFAULT_REJECTION_TEMPLATE_NAME,
      subject: template.subject,
      html_body: template.html_body,
      text_body: template.text_body,
      variables: [...REJECTION_TEMPLATE_VARIABLES],
      is_active: true,
      updated_by: profile.user_id,
    };

    const { data, error } = await supabase
      .from("company_email_templates")
      .upsert(payload, { onConflict: "company_id,key" })
      .select("*")
      .single();

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    setTemplate({
      ...data,
      variables: Array.isArray(data.variables) ? data.variables : [...REJECTION_TEMPLATE_VARIABLES],
    });
    toast.success("Email template saved");
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (!template) {
    return <div className="text-sm text-muted-foreground">Template unavailable.</div>;
  }

  const previewVariables = {
    ...SAMPLE_REJECTION_VARIABLES,
    company_name: companyName || SAMPLE_REJECTION_VARIABLES.company_name,
  };
  const renderedSubject = renderTemplate(template.subject, previewVariables);
  const renderedHtml = sanitizeRichHtml(renderTemplate(template.html_body, previewVariables));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email Templates</h1>
          <p className="text-sm text-muted-foreground">Candidate rejection email</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="space-y-5 p-5">
          <div className="space-y-2">
            <Label htmlFor="rejection-subject">Subject</Label>
            <Input
              id="rejection-subject"
              ref={subjectInputRef}
              value={template.subject}
              onChange={(event) => setTemplate({ ...template, subject: event.target.value })}
            />
            <VariableChips variables={template.variables} onInsert={insertSubjectToken} />
          </div>

          <div className="space-y-2">
            <Label>Email Body</Label>
            <RichTextEditor
              value={template.html_body}
              onChange={(html) => setTemplate({ ...template, html_body: html })}
              placeholder="Write the rejection email..."
            />
            <VariableChips variables={template.variables} onInsert={insertBodyToken} />
          </div>

          <div className="flex justify-end border-t pt-4">
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
