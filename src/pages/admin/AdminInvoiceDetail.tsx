import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { getInvoiceDownloadUrl, requestInvoicePdf } from "@/lib/invoiceUrl";
import { logInvoiceEvent } from "@/lib/invoices";
import InvoiceEventsTimeline from "@/components/billing/InvoiceEventsTimeline";
import { ArrowLeft, Download, FileText, RefreshCw, Send, CheckCircle2, AlertTriangle, Ban, Mail } from "lucide-react";

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
  paid_at: string | null;
  pdf_r2_key: string | null;
  pdf_generated_at: string | null;
  pdf_version: number | null;
  bill_to_legal_name: string | null;
  bill_to_email: string | null;
  bill_to_contact_name: string | null;
  bill_to_phone: string | null;
  bill_to_address: string | null;
  bill_to_trn: string | null;
  bill_to_customer_code: string | null;
};

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  amount_cents: number;
  source: string;
};

export default function AdminInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { role, user } = useAuth();
  const isSuperAdmin = role === "super_admin";
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [eventsKey, setEventsKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [{ data, error }, liRes] = await Promise.all([
      (supabase as any).from("invoices").select("*").eq("id", id).maybeSingle(),
      (supabase as any).from("invoice_line_items").select("*").eq("invoice_id", id).order("created_at"),
    ]);
    if (error) toast({ title: "Failed to load invoice", description: error.message, variant: "destructive" });
    setInvoice((data as Invoice) ?? null);
    setLineItems((liRes.data as LineItem[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleGenerate() {
    if (!id) return;
    setBusy(true);
    try {
      const wasPresent = !!invoice?.pdf_r2_key;
      await requestInvoicePdf(id);
      await logInvoiceEvent(id, wasPresent ? "pdf_regenerated" : "pdf_generated", { actor_user_id: user?.id ?? null });
      toast({ title: "PDF generated" });
      setEventsKey((k) => k + 1);
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

  async function handleEmail() {
    if (!id || !invoice) return;
    const to = invoice.bill_to_email;
    if (!to) {
      toast({ title: "No billing email on invoice", variant: "destructive" });
      return;
    }
    if (!confirm(`Send this invoice to ${to}?`)) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).functions.invoke("send-invoice-email", {
        body: { invoice_id: id },
      });
      if (error) throw error;
      toast({ title: "Invoice emailed", description: `Sent to ${to}` });
      setEventsKey((k) => k + 1);
    } catch (e: any) {
      toast({ title: "Email failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(patch: Record<string, any>, label: string, event: string) {
    if (!id) return;
    setBusy(true);
    const { error } = await (supabase as any).from("invoices").update(patch).eq("id", id);
    setBusy(false);
    if (error) {
      toast({ title: `${label} failed`, description: error.message, variant: "destructive" });
      return;
    }
    await logInvoiceEvent(id, event, { actor_user_id: user?.id ?? null, patch });
    toast({ title: label });
    setEventsKey((k) => k + 1);
    await load();
  }

  const issue = () => updateStatus({ status: "sent", issued_at: new Date().toISOString() }, "Invoice issued", "issued");
  const markPaid = () => updateStatus({ status: "paid", paid_at: new Date().toISOString() }, "Marked as paid", "marked_paid");
  const markOverdue = () => updateStatus({ status: "overdue" }, "Marked as overdue", "marked_overdue");
  const voidInvoice = () => {
    if (!confirm("Void this invoice? This cannot be undone.")) return;
    return updateStatus({ status: "void" }, "Invoice voided", "voided");
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading invoice…</div>;
  if (!invoice) return <div className="p-6">Invoice not found.</div>;

  const hasPdf = !!invoice.pdf_r2_key;
  const status = invoice.status ?? "draft";
  const canIssue = isSuperAdmin && status === "draft";
  const canMarkPaid = isSuperAdmin && (status === "sent" || status === "overdue");
  const canMarkOverdue = isSuperAdmin && status === "sent";
  const canVoid = isSuperAdmin && status !== "paid" && status !== "void";

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
          {canIssue && (
            <Button onClick={issue} disabled={busy} variant="default">
              <Send className="h-4 w-4" /> Issue
            </Button>
          )}
          {canMarkPaid && (
            <Button onClick={markPaid} disabled={busy} variant="default">
              <CheckCircle2 className="h-4 w-4" /> Mark paid
            </Button>
          )}
          {canMarkOverdue && (
            <Button onClick={markOverdue} disabled={busy} variant="outline">
              <AlertTriangle className="h-4 w-4" /> Mark overdue
            </Button>
          )}
          {canVoid && (
            <Button onClick={voidInvoice} disabled={busy} variant="outline">
              <Ban className="h-4 w-4" /> Void
            </Button>
          )}
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
          {isSuperAdmin && status !== "draft" && (
            <Button onClick={handleEmail} disabled={busy} variant="outline">
              <Mail className="h-4 w-4" /> Email to customer
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
          <div><div className="text-muted-foreground">Paid</div><div>{invoice.paid_at ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Total</div><div>{invoice.currency} {(invoice.total_cents ?? 0) / 100}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Bill to (snapshot)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div><div className="text-muted-foreground">Legal name</div><div>{invoice.bill_to_legal_name ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Customer code</div><div>{invoice.bill_to_customer_code ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Email</div><div>{invoice.bill_to_email ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Contact</div><div>{invoice.bill_to_contact_name ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Phone</div><div>{invoice.bill_to_phone ?? "—"}</div></div>
          <div><div className="text-muted-foreground">TRN</div><div>{invoice.bill_to_trn ?? "—"}</div></div>
          <div className="col-span-2"><div className="text-muted-foreground">Address</div><div className="whitespace-pre-wrap">{invoice.bill_to_address ?? "—"}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Line items</CardTitle></CardHeader>
        <CardContent>
          {lineItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No line items.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2">Description</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Unit</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-2">{l.description}</td>
                    <td className="py-2 text-right">{l.quantity}</td>
                    <td className="py-2 text-right">{(l.unit_price_cents / 100).toFixed(2)}</td>
                    <td className="py-2 text-right">{(l.amount_cents / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <InvoiceEventsTimeline invoiceId={invoice.id} refreshKey={eventsKey} />
    </div>
  );
}
