import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { FilePlus2, Loader2 } from "lucide-react";
import { generateInvoiceForNextCycle } from "@/lib/invoices";

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  status: string | null;
  currency: string | null;
  total_cents: number | null;
  period_start: string | null;
  period_end: string | null;
  issued_at: string | null;
  pdf_r2_key: string | null;
}

interface Props {
  companyId: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export default function CompanyInvoicesCard({ companyId }: Props) {
  const { role, user } = useAuth();
  const isSuperAdmin = role === "super_admin";
  const nav = useNavigate();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("invoices")
      .select("id, invoice_number, status, currency, total_cents, period_start, period_end, issued_at, pdf_r2_key")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as InvoiceRow[]) ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const id = await generateInvoiceForNextCycle(companyId, user?.id ?? null);
      toast.success("Draft invoice created");
      nav(`/admin/billing/invoices/${id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate invoice");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Invoices</h3>
          <p className="text-sm text-muted-foreground">Manual generation for the next billing cycle.</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FilePlus2 className="w-4 h-4 mr-1" />}
            Generate invoice for next cycle
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading invoices…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.invoice_number ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.period_start} → {r.period_end}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "paid" ? "default" : r.status === "overdue" ? "destructive" : "secondary"}>
                    {STATUS_LABEL[r.status ?? "draft"] ?? r.status}
                  </Badge>
                </TableCell>
                <TableCell>{r.currency} {((r.total_cents ?? 0) / 100).toFixed(2)}</TableCell>
                <TableCell className="text-xs">{r.issued_at ? new Date(r.issued_at).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/admin/billing/invoices/${r.id}`}>Open</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
