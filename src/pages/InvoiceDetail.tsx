import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { getInvoiceDownloadUrl } from "@/lib/invoiceUrl";
import { logInvoiceEvent } from "@/lib/invoices";
import { ArrowLeft, Download } from "lucide-react";

type Invoice = {
  id: string;
  company_id: string;
  invoice_number: string | null;
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

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile, user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [{ data, error }, liRes] = await Promise.all([
        (supabase as any).from("invoices").select("*").eq("id", id).maybeSingle(),
        (supabase as any).from("invoice_line_items").select("*").eq("invoice_id", id).order("created_at"),
      ]);
      if (error) toast({ title: "Failed to load invoice", description: error.message, variant: "destructive" });
      setInvoice((data as Invoice) ?? null);
      setLineItems((liRes.data as LineItem[]) ?? []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading invoice…</div>;
  if (!invoice) return <div className="p-6">Invoice not found.</div>;

  // Tenant safety: must belong to user's company, and not a draft
  if (profile?.company_id && invoice.company_id !== profile.company_id) {
    return <Navigate to="/billing" replace />;
  }
  if (invoice.status === "draft") {
    return <Navigate to="/billing" replace />;
  }

  async function handleDownload() {
    if (!id || !invoice) return;
    try {
      const url = await getInvoiceDownloadUrl(id);
      await logInvoiceEvent(id, "pdf_downloaded", { actor_user_id: user?.id ?? null });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    }
  }

  const hasPdf = !!invoice.pdf_r2_key;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/billing" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to billing
          </Link>
          <h1 className="text-2xl font-semibold mt-2">{invoice.invoice_number ?? "Invoice"}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={invoice.status === "paid" ? "default" : invoice.status === "overdue" ? "destructive" : "secondary"}>
              {invoice.status ?? "—"}
            </Badge>
          </div>
        </div>
        {hasPdf ? (
          <Button onClick={handleDownload} variant="secondary">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">PDF not yet available</span>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Invoice details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div><div className="text-muted-foreground">Period</div><div>{invoice.period_start} → {invoice.period_end}</div></div>
          <div><div className="text-muted-foreground">Issued</div><div>{invoice.issued_at ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Due</div><div>{invoice.due_at ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Paid</div><div>{invoice.paid_at ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Subtotal</div><div>{invoice.currency} {((invoice.subtotal_cents ?? 0) / 100).toFixed(2)}</div></div>
          <div><div className="text-muted-foreground">Discount</div><div>{invoice.currency} {((invoice.discount_cents ?? 0) / 100).toFixed(2)}</div></div>
          <div className="col-span-2"><div className="text-muted-foreground">Total</div><div className="text-lg font-semibold">{invoice.currency} {((invoice.total_cents ?? 0) / 100).toFixed(2)}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Bill to</CardTitle></CardHeader>
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
    </div>
  );
}
