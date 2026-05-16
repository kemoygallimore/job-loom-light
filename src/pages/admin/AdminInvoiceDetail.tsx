import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { getInvoiceDownloadUrl, requestInvoicePdf } from "@/lib/invoiceUrl";
import { ArrowLeft, Download, FileText, RefreshCw } from "lucide-react";

type Invoice = {
  id: string;
  invoice_number: string | null;
  company_id: string;
  status: string | null;
  currency: string | null;
  subtotal_cents: number | null;
  discount_cents: number | null;
  total_cents: number | null;
  period_start: string | null;
  period_end: string | null;
  issued_at: string | null;
  due_at: string | null;
  pdf_r2_key: string | null;
  pdf_generated_at: string | null;
  pdf_version: number | null;
};

export default function AdminInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const isSuperAdmin = role === "super_admin";
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) toast({ title: "Failed to load invoice", description: error.message, variant: "destructive" });
    setInvoice((data as Invoice) ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleGenerate() {
    if (!id) return;
    setBusy(true);
    try {
      await requestInvoicePdf(id);
      toast({ title: "PDF generated" });
      await load();
    } catch (e: any) {
      toast({ title: "PDF generation failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    if (!id) return;
    try {
      const url = await getInvoiceDownloadUrl(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading invoice…</div>;
  if (!invoice) return <div className="p-6">Invoice not found.</div>;

  const hasPdf = !!invoice.pdf_r2_key;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/billing" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to billing
          </Link>
          <h1 className="text-2xl font-semibold mt-2">{invoice.invoice_number ?? "Invoice"}</h1>
          <p className="text-sm text-muted-foreground">Status: {invoice.status ?? "—"}</p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <Button onClick={handleGenerate} disabled={busy} variant={hasPdf ? "outline" : "default"}>
              {hasPdf ? <RefreshCw className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              {hasPdf ? "Regenerate PDF" : "Generate PDF"}
            </Button>
          )}
          {hasPdf && (
            <Button onClick={handleDownload} variant="secondary">
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>PDF</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">PDF Generated At</div>
            <div>{invoice.pdf_generated_at ? new Date(invoice.pdf_generated_at).toLocaleString() : "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">PDF Version</div>
            <div>{invoice.pdf_version ?? 0}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Invoice details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div><div className="text-muted-foreground">Period</div><div>{invoice.period_start} → {invoice.period_end}</div></div>
          <div><div className="text-muted-foreground">Issued</div><div>{invoice.issued_at ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Due</div><div>{invoice.due_at ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Total</div><div>{invoice.currency} {(invoice.total_cents ?? 0) / 100}</div></div>
        </CardContent>
      </Card>
    </div>
  );
}
