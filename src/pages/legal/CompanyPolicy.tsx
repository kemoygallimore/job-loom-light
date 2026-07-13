import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import { formatPolicyDate } from "@/lib/consentPolicies";

interface CompanyPolicyRow {
  company_name: string;
  title: string;
  content_html: string;
  published_at: string;
}

export default function CompanyPolicy() {
  const { companySlug = "" } = useParams();
  const [policy, setPolicy] = useState<CompanyPolicyRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).rpc("get_public_company_policy", {
        _company_slug: companySlug,
        _policy_key: "candidate_privacy_notice",
      });
      const row = Array.isArray(data) ? data[0] : data;
      setPolicy(row ?? null);
      setLoading(false);
    })();
  }, [companySlug]);

  const safeHtml = sanitizeRichHtml(policy?.content_html ?? "");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <Link
            to={`/${companySlug}/careers`}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back
          </Link>
          <div className="flex items-start gap-3">
            <FileText className="mt-1 size-5 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {loading ? "Loading policy" : policy?.title ?? "Policy unavailable"}
              </h1>
              {policy && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {policy.company_name} · Last updated: {formatPolicyDate(policy.published_at)}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : policy ? (
          <div
            className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary sm:prose-base"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <h2 className="font-semibold">No published company policy</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This company has not published a candidate privacy notice yet.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
