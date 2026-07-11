import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText } from "lucide-react";

type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  company_id: string;
  status: string | null;
  currency: string | null;
  total_cents: number | null;
  issued_at: string | null;
  due_at: string | null;
  pdf_r2_key: string | null;
  companies?: { name: string | null } | null;
};

const STATUSES = ["all", "draft", "sent", "paid", "overdue", "void"] as const;

export default function AdminBilling() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = (supabase as any)
        .from("invoices")
        .select("id, invoice_number, company_id, status, currency, total_cents, issued_at, due_at, pdf_r2_key")
        .order("issued_at", { ascending: false, nullsFirst: false });
      if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) {
        toast.error("Failed to load invoices", { description: error.message });
        setRows([]);
        setLoading(false);
        return;
      }
      const invoices = (data as InvoiceRow[]) ?? [];
      const companyIds = Array.from(new Set(invoices.map((i) => i.company_id).filter(Boolean)));
      const companyMap: Record<string, string> = {};
      if (companyIds.length) {
        const { data: cdata } = await (supabase as any)
          .from("companies")
          .select("id, name")
          .in("id", companyIds);
        (cdata ?? []).forEach((c: any) => { companyMap[c.id] = c.name; });
      }
      setRows(invoices.map((i) => ({ ...i, companies: { name: companyMap[i.company_id] ?? null } })));
      setLoading(false);
    })();
  }, [status]);

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      (r.invoice_number ?? "").toLowerCase().includes(needle) ||
      (r.companies?.name ?? "").toLowerCase().includes(needle)
    );
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Billing</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <div className="flex gap-2 pt-2">
            <Input
              placeholder="Search by invoice # or company"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-sm"
            />
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground">No invoices found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>PDF</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.invoice_number ?? r.id.slice(0, 8)}</TableCell>
                    <TableCell>{r.companies?.name ?? "—"}</TableCell>
                    <TableCell>{r.issued_at ? new Date(r.issued_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{r.due_at ? new Date(r.due_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{r.status ?? "—"}</Badge></TableCell>
                    <TableCell>{r.currency} {(r.total_cents ?? 0) / 100}</TableCell>
                    <TableCell>
                      {r.pdf_r2_key ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" /> ready
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/admin/billing/invoices/${r.id}`} className="text-primary text-sm hover:underline">View</Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
