import { supabase } from "@/integrations/supabase/client";

/**
 * Calls the `get-invoice-download-url` Edge Function on the external Supabase
 * project and returns a short-lived signed PDF URL from Cloudflare R2.
 * The frontend never talks to the Cloudflare Worker directly.
 */
export async function getInvoiceDownloadUrl(invoiceId: string): Promise<string> {
  if (!invoiceId) throw new Error("invoiceId is required");

  const { data, error } = await supabase.functions.invoke<{
    url: string;
    expires_in: number | null;
  }>("get-invoice-download-url", {
    body: { invoice_id: invoiceId },
  });

  if (error) {
    throw new Error(error.message || "Failed to get invoice download URL");
  }
  if (!data?.url) {
    throw new Error("No download URL returned");
  }
  return data.url;
}

/**
 * Calls the `request-invoice-pdf` Edge Function (super-admin only).
 * Generates or regenerates the invoice PDF on Cloudflare R2 and updates
 * `pdf_r2_key`, `pdf_generated_at`, and `pdf_version` on the invoice row.
 */
export async function requestInvoicePdf(invoiceId: string): Promise<unknown> {
  if (!invoiceId) throw new Error("invoiceId is required");

  const { data, error } = await supabase.functions.invoke<{
    success: boolean;
    invoice: unknown;
  }>("request-invoice-pdf", {
    body: { invoice_id: invoiceId },
  });

  if (error) {
    throw new Error(error.message || "Failed to generate invoice PDF");
  }
  return data?.invoice;
}
