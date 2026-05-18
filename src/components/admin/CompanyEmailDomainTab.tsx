import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, ShieldCheck, Trash2, Plus, Save, Copy } from "lucide-react";

interface Props { companyId: string }

interface CompanyDomain {
  email_domain: string | null;
  email_domain_status: string;
  email_provider_domain_id: string | null;
  email_from_name: string | null;
  email_reply_to: string | null;
  email_domain_last_checked_at: string | null;
  email_domain_records: any[] | null;
}

const statusColor: Record<string, string> = {
  verified: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
  unverified: "bg-muted text-muted-foreground",
};

export default function CompanyEmailDomainTab({ companyId }: Props) {
  const [data, setData] = useState<CompanyDomain | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [domain, setDomain] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: row } = await supabase
      .from("companies")
      .select("email_domain, email_domain_status, email_provider_domain_id, email_from_name, email_reply_to, email_domain_last_checked_at, email_domain_records" as any)
      .eq("id", companyId)
      .maybeSingle();
    const d = row as any as CompanyDomain;
    setData(d);
    setDomain(d?.email_domain ?? "");
    setFromName(d?.email_from_name ?? "");
    setReplyTo(d?.email_reply_to ?? "");
    setLoading(false);
  }, [companyId]);

  useEffect(() => { refresh(); }, [refresh]);

  const call = async (action: string, body: Record<string, any> = {}) => {
    setBusy(action);
    const { data: res, error } = await supabase.functions.invoke("manage-company-domain", {
      body: { action, company_id: companyId, ...body },
    });
    setBusy(null);
    if (error || (res as any)?.error) {
      toast.error((res as any)?.error || error?.message || "Action failed");
      return false;
    }
    toast.success("Done");
    await refresh();
    return true;
  };

  if (loading || !data) return <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>;

  const hasDomain = !!data.email_provider_domain_id;
  const status = data.email_domain_status ?? "unverified";

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Sending domain</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Candidate emails will come from this domain once verified. Otherwise the default RizonHire sender is used.
            </p>
          </div>
          <Badge className={statusColor[status] ?? statusColor.unverified}>{status}</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Domain</Label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="mail.acme.com"
              disabled={hasDomain}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">From name</Label>
            <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Acme Careers" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Reply-to (optional)</Label>
            <Input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="careers@acme.com" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!hasDomain ? (
            <Button onClick={() => call("register", { domain, from_name: fromName, reply_to: replyTo })} disabled={!domain || busy !== null}>
              <Plus className="w-4 h-4 mr-2" /> {busy === "register" ? "Registering..." : "Register domain"}
            </Button>
          ) : (
            <>
              <Button onClick={() => call("update_meta", { from_name: fromName, reply_to: replyTo })} variant="outline" disabled={busy !== null}>
                <Save className="w-4 h-4 mr-2" /> Save meta
              </Button>
              <Button onClick={() => call("refresh_status")} variant="outline" disabled={busy !== null}>
                <RefreshCw className="w-4 h-4 mr-2" /> {busy === "refresh_status" ? "Checking..." : "Refresh status"}
              </Button>
              <Button onClick={() => call("verify")} disabled={busy !== null || status === "verified"}>
                <ShieldCheck className="w-4 h-4 mr-2" /> {busy === "verify" ? "Verifying..." : "Verify"}
              </Button>
              <Button
                onClick={() => { if (confirm("Remove this sending domain?")) call("remove"); }}
                variant="ghost"
                className="text-destructive"
                disabled={busy !== null}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Remove
              </Button>
            </>
          )}
        </div>

        {data.email_domain_last_checked_at && (
          <p className="text-xs text-muted-foreground">
            Last checked: {new Date(data.email_domain_last_checked_at).toLocaleString()}
          </p>
        )}
      </div>

      {hasDomain && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="text-sm font-semibold">DNS records</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Add these records at your DNS provider, then click Verify.
            </p>
          </div>
          {(data.email_domain_records ?? []).length === 0 ? (
            <div className="p-8 text-sm text-center text-muted-foreground">No records returned.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="text-center">TTL</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.email_domain_records ?? []).map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{r.type ?? r.record}</TableCell>
                    <TableCell className="font-mono text-xs break-all">{r.name}</TableCell>
                    <TableCell className="font-mono text-xs break-all">
                      <div className="flex items-start gap-2">
                        <span className="flex-1">{r.value}</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(r.value ?? ""); toast.success("Copied"); }}
                          className="text-muted-foreground hover:text-foreground"
                          title="Copy"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs tabular-nums">{r.ttl ?? "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px]">{r.status ?? "—"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
