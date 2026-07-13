import { useEffect, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { formatPolicyDate } from "@/lib/consentPolicies";

interface ConsentRecord {
  id: string;
  consent_key: string;
  source_flow: string;
  consent_text: string;
  accepted_at: string;
  platform_policy_title: string | null;
  platform_policy_updated_at: string | null;
  company_policy_title: string | null;
  company_policy_published_at: string | null;
}

function label(value: string) {
  return value.replace(/_/g, " ");
}

export default function ConsentHistory({ candidateId }: { candidateId: string }) {
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("consent_records")
        .select("id, consent_key, source_flow, consent_text, accepted_at, platform_policy_title, platform_policy_updated_at, company_policy_title, company_policy_published_at")
        .eq("candidate_id", candidateId)
        .order("accepted_at", { ascending: false });
      setRecords((data ?? []) as ConsentRecord[]);
      setLoading(false);
    })();
  }, [candidateId]);

  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Consent History
      </h2>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-muted-foreground">No consent records found for this candidate.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {records.map((record) => (
            <article key={record.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="size-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium capitalize">{label(record.consent_key)}</p>
                    <p className="text-xs text-muted-foreground">
                      Accepted {new Date(record.accepted_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">{label(record.source_flow)}</Badge>
              </div>
              <p className="mt-3 text-sm">{record.consent_text}</p>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div>
                  <span className="font-medium text-foreground">RizonHire:</span>{" "}
                  {record.platform_policy_title ?? "Data Protection Policy"}
                  <br />
                  Last updated: {formatPolicyDate(record.platform_policy_updated_at)}
                </div>
                <div>
                  <span className="font-medium text-foreground">Company:</span>{" "}
                  {record.company_policy_title ?? "No company policy captured"}
                  <br />
                  Last updated: {formatPolicyDate(record.company_policy_published_at)}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
