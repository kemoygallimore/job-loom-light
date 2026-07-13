import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getInvoiceDownloadUrl, requestInvoicePdf } from "@/lib/storage";
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
  payment_method: string | null;
  payment_reference: string | null;
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
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("");
  const [payReference, setPayReference] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));

  async function load() {
    if (!id) return;
    setLoading(true);
    const [{ data, error }, liRes] = await Promise.all([
      (supabase as any).from("invoices").select("*").eq("id", id).maybeSingle(),
      (supabase as any).from("invoice_line_items").select("*").eq("invoice_id", id).order("created_at"),
    ]);
    if (error) toast.error("Failed to load invoice", { description: error.message });
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
      toast.success("PDF generated");
      setEventsKey((k) => k + 1);
      await load();
    } catch (e: any) {
      toast.error("PDF generation failed", { description: e.message });
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
      toast.error("Download failed", { description: e.message });
    }
  }

  async function handleEmail() {
    if (!id || !invoice) return;
    const to = invoice.bill_to_email;
    if (!to) {
      toast.error("No billing email on invoice");
      return;
    }
    if (!confirm(`Send this invoice to ${to}?`)) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).functions.invoke("send-invoice-email", {
        body: { invoice_id: id },
      });
      if (error) throw error;
      toast.success("Invoice emailed", { description: `Sent to ${to}` });
      setEventsKey((k) => k + 1);
    } catch (e: any) {
      toast.error("Email failed", { description: e.message });
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
      toast.error(`${label} failed`, { description: error.message });
      return;
    }
    await logInvoiceEvent(id, event, { actor_user_id: user?.id ?? null, patch });
    toast.success(label);
    setEventsKey((k) => k + 1);
    await load();
  }

  const issue = () => updateStatus({ status: "sent", issued_at: new Date().toISOString() }, "Invoice issued", "issued");
  const markOverdue = () => updateStatus({ status: "overdue" }, "Marked as overdue", "marked_overdue");
  const voidInvoice = () => {
    if (!confirm("Void this invoice? This cannot be undone.")) return;
    return updateStatus({ status: "void" }, "Invoice voided", "voided");
  };

  async function submitMarkPaid() {
    if (!id) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).functions.invoke("mark-invoice-paid", {
        body: {
          invoice_id: id,
          payment_method: payMethod || null,
          payment_reference: payReference || null,
          paid_at: payDate ? new Date(payDate + "T00:00:00Z").toISOString() : undefined,
          send_receipt: true,
        },
      });
      if (error) throw error;
      toast.success("Invoice marked paid", {
        description: data?.advanced
          ? `Subscription advanced to ${data.advanced.to}`
          : "Receipt emailed to customer.",
      });
      setPayOpen(false);
      setPayMethod(""); setPayReference("");
      setEventsKey((k) => k + 1);
      await load();
    } catch (e: any) {
      toast.error("Mark paid failed", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

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
            <Button onClick={() => setPayOpen(true)} disabled={busy} variant="default">
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

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark invoice as paid</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="pay-date">Payment date</Label>
              <Input id="pay-date" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pay-method">Payment method</Label>
              <Input id="pay-method" placeholder="e.g. Bank transfer, Stripe, Cheque" value={payMethod} onChange={(e) => setPayMethod(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pay-ref">Reference</Label>
              <Input id="pay-ref" placeholder="Transaction id / cheque #" value={payReference} onChange={(e) => setPayReference(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">A receipt will be emailed to {invoice.bill_to_email ?? "the billing contact"}.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submitMarkPaid} disabled={busy}>Confirm payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
