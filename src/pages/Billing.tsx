import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { getInvoiceDownloadUrl } from "@/lib/invoiceUrl";
import { Download } from "lucide-react";
import BillingProfileForm from "@/components/billing/BillingProfileForm";
import BillingCycleCard from "@/components/billing/BillingCycleCard";

type Invoice = {
  id: string;
  invoice_number: string | null;
  status: string | null;
  currency: string | null;
  total_cents: number | null;
  issued_at: string | null;
  pdf_r2_key: string | null;
};

export default function Billing() {
  const { profile, role } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.company_id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("invoices")
        .select("id, invoice_number, status, currency, total_cents, issued_at, pdf_r2_key")
        .eq("company_id", profile.company_id)
        .order("issued_at", { ascending: false });
      if (error) toast({ title: "Failed to load invoices", description: error.message, variant: "destructive" });
      setInvoices((data as Invoice[]) ?? []);
      setLoading(false);
    })();
  }, [profile?.company_id]);

  async function handleDownload(invoiceId: string) {
    try {
      const url = await getInvoiceDownloadUrl(invoiceId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>
      {profile?.company_id && (
        <Card>
          <CardContent className="pt-6">
            <BillingProfileForm companyId={profile.company_id} canEdit={role === "admin"} />
          </CardContent>
        </Card>
      )}
      {profile?.company_id && (
        <Card>
          <CardContent className="pt-6">
            <BillingCycleCard companyId={profile.company_id} canEdit={false} />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Invoice history</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : invoices.length === 0 ? (
            <p className="text-muted-foreground">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.invoice_number ?? inv.id.slice(0, 8)}</TableCell>
                    <TableCell>{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{inv.status ?? "—"}</TableCell>
                    <TableCell>{inv.currency} {(inv.total_cents ?? 0) / 100}</TableCell>
                    <TableCell className="text-right">
                      {inv.pdf_r2_key ? (
                        <Button size="sm" variant="secondary" onClick={() => handleDownload(inv.id)}>
                          <Download className="h-4 w-4" /> Download PDF
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">PDF not yet available</span>
                      )}
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
