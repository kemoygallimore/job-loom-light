import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Save, Send, AlertTriangle, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RichTextEditor } from "@/components/RichTextEditor";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import { formatPolicyDate } from "@/lib/consentPolicies";

const POLICY_KEY = "candidate_privacy_notice";

interface CompanyPolicyDraft {
  id: string;
  draft_title: string;
  draft_content_html: string;
  published_version_id: string | null;
  updated_at: string;
}

interface CompanyPolicyVersion {
  id: string;
  version_number: number;
  title: string;
  content_html: string;
  published_at: string;
}

function emptyDraft() {
  return {
    title: "Candidate Privacy Notice",
    html: "",
  };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function CompanyDataProtection() {
  const { profile, role, user } = useAuth();
  const [policy, setPolicy] = useState<CompanyPolicyDraft | null>(null);
  const [versions, setVersions] = useState<CompanyPolicyVersion[]>([]);
  const [title, setTitle] = useState(emptyDraft().title);
  const [html, setHtml] = useState(emptyDraft().html);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const currentVersion = useMemo(
    () => versions.find((version) => version.id === policy?.published_version_id) ?? versions[0] ?? null,
    [policy?.published_version_id, versions],
  );
  const hasPublishedPolicy = Boolean(currentVersion);
  const canManage = role === "admin";

  const load = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    const [policyRes, versionsRes] = await Promise.all([
      (supabase as any)
        .from("company_policies")
        .select("id, draft_title, draft_content_html, published_version_id, updated_at")
        .eq("company_id", profile.company_id)
        .eq("key", POLICY_KEY)
        .maybeSingle(),
      (supabase as any)
        .from("company_policy_versions")
        .select("id, version_number, title, content_html, published_at")
        .eq("company_id", profile.company_id)
        .eq("key", POLICY_KEY)
        .order("version_number", { ascending: false }),
    ]);

    setLoading(false);
    if (policyRes.error) {
      toast.error(policyRes.error.message);
      return;
    }
    if (versionsRes.error) {
      toast.error(versionsRes.error.message);
      return;
    }

    const nextPolicy = policyRes.data as CompanyPolicyDraft | null;
    const nextVersions = (versionsRes.data ?? []) as CompanyPolicyVersion[];
    setPolicy(nextPolicy);
    setVersions(nextVersions);
    setTitle(nextPolicy?.draft_title ?? emptyDraft().title);
    setHtml(nextPolicy?.draft_content_html ?? emptyDraft().html);
  }, [profile?.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  const saveDraft = async () => {
    if (!profile?.company_id || !user?.id) return;
    if (!title.trim()) {
      toast.error("Policy title is required");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("company_policies").upsert(
      {
        company_id: profile.company_id,
        key: POLICY_KEY,
        draft_title: title.trim(),
        draft_content_html: html,
        created_by: user.id,
        updated_by: user.id,
      },
      { onConflict: "company_id,key" },
    );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Draft saved");
    load();
  };

  const publish = async () => {
    if (!title.trim() || !html.trim()) {
      toast.error("Title and content are required before publishing");
      return;
    }
    setPublishing(true);
    const { error } = await (supabase as any).rpc("publish_company_policy", {
      _policy_key: POLICY_KEY,
      _title: title.trim(),
      _content_html: html,
    });
    setPublishing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Policy published");
    load();
  };

  if (!profile?.company_id) {
    return <p className="text-sm text-muted-foreground">Your account is missing a company profile.</p>;
  }

  if (!canManage) {
    return (
      <Alert>
        <AlertTriangle className="size-4" />
        <AlertTitle>Admin access required</AlertTitle>
        <AlertDescription>Only company admins can manage the candidate privacy notice.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Data Protection</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Maintain the candidate privacy notice shown on your public hiring flows.
          </p>
        </div>
        {hasPublishedPolicy ? <Badge variant="secondary">Published</Badge> : <Badge variant="outline">No published policy</Badge>}
      </div>

      {!hasPublishedPolicy && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>No published candidate privacy notice</AlertTitle>
          <AlertDescription>
            Candidates will only see the RizonHire platform data protection policy until you publish a company notice.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Draft policy</h2>
              <p className="text-sm text-muted-foreground">
                Published versions are locked for audit history. Edit the draft, then publish a new version.
              </p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="mr-2 size-4" /> Preview
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{title || "Candidate Privacy Notice"}</DialogTitle>
                </DialogHeader>
                <div
                  className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html || "<p>No content yet.</p>") }}
                />
              </DialogContent>
            </Dialog>
          </div>

          <Alert>
            <FileText className="size-4" />
            <AlertTitle>Company-provided legal notice</AlertTitle>
            <AlertDescription>
              This notice is provided by your company. Have it reviewed by your legal advisor before publishing.
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-2">
            <Label htmlFor="company-policy-title">Title</Label>
            <Input
              id="company-policy-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={loading}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Content</Label>
            <RichTextEditor value={html} onChange={setHtml} placeholder="Write your candidate privacy notice..." />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveDraft} disabled={saving || loading}>
              <Save className="mr-2 size-4" /> {saving ? "Saving…" : "Save draft"}
            </Button>
            <Button onClick={publish} disabled={publishing || loading}>
              <Send className="mr-2 size-4" /> {publishing ? "Publishing…" : "Publish policy"}
            </Button>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="font-semibold">Current version</h2>
            {currentVersion ? (
              <div className="mt-3 text-sm">
                <p className="font-medium">Version {currentVersion.version_number}</p>
                <p className="text-muted-foreground">{currentVersion.title}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Published {formatPolicyDate(currentVersion.published_at)}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Nothing published yet.</p>
            )}
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="font-semibold">Version history</h2>
            <div className="mt-3 flex flex-col gap-3">
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Published versions will appear here.</p>
              ) : (
                versions.map((version) => (
                  <div key={version.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">v{version.version_number}</span>
                      {version.id === policy?.published_version_id && <Badge variant="secondary">Current</Badge>}
                    </div>
                    <p className="mt-1 truncate text-muted-foreground">{version.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatPolicyDate(version.published_at)}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
