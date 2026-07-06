import puppeteer from "@cloudflare/puppeteer";
import { AwsClient } from "aws4fetch";

const INVOICE_BUCKET_NAME = "rizonhire-invoices";
const SIGNED_URL_EXPIRY_SECONDS = 300;

export interface InvoicePdfEnv {
  INVOICE_BUCKET: R2Bucket;
  BROWSER: Fetcher;

  R2_WORKER_SECRET: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
}

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders()
  });
}

function isAuthorized(request: Request, env: InvoicePdfEnv) {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return false;
  }

  return authHeader === `Bearer ${env.R2_WORKER_SECRET}`;
}

function safeText(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeKeyPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function formatMoney(cents: number, currency = "USD") {
  const amount = Number(cents || 0) / 100;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(amount);
}

function buildInvoiceHtml(payload: any) {
  const invoice = payload.invoice;
  const company = payload.company || {};
  const lineItems = payload.line_items || [];
  const currency = invoice.currency || "USD";

  const rows = lineItems
    .map((item: any) => {
      return `
        <tr>
          <td>${safeText(item.description)}</td>
          <td class="center">${safeText(item.quantity)}</td>
          <td class="right">${formatMoney(item.unit_price_cents, currency)}</td>
          <td class="right">${formatMoney(item.amount_cents, currency)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />

        <style>
          body {
            font-family: Arial, sans-serif;
            color: #111827;
            margin: 0;
            padding: 40px;
            background: #ffffff;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid #111827;
            padding-bottom: 20px;
            margin-bottom: 35px;
          }

          .brand {
            font-size: 28px;
            font-weight: 800;
            color: #111827;
          }

          .tagline {
            margin-top: 4px;
            color: #6b7280;
            font-size: 13px;
          }

          .invoice-title {
            font-size: 26px;
            font-weight: 800;
            text-align: right;
            color: #111827;
          }

          .invoice-number {
            text-align: right;
            color: #6b7280;
            font-size: 13px;
            margin-top: 4px;
          }

          .section {
            margin-bottom: 24px;
          }

          .label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 6px;
          }

          .company-name {
            font-size: 18px;
            font-weight: 700;
          }

          .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 30px;
          }

          .detail-box {
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 16px;
            background: #f9fafb;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }

          th {
            background: #111827;
            color: white;
            text-align: left;
            padding: 12px;
            font-size: 13px;
          }

          td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 13px;
          }

          .right {
            text-align: right;
          }

          .center {
            text-align: center;
          }

          .summary {
            margin-top: 30px;
            width: 340px;
            margin-left: auto;
          }

          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
            font-size: 14px;
          }

          .total {
            font-size: 20px;
            font-weight: 800;
            color: #111827;
          }

          .status-badge {
            display: inline-block;
            padding: 6px 10px;
            border-radius: 999px;
            background: #eef2ff;
            color: #3730a3;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .footer {
            margin-top: 70px;
            padding-top: 18px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 12px;
            text-align: center;
          }
        </style>
      </head>

      <body>
        <div class="header">
          <div>
            <div class="brand">RizonHire</div>
            <div class="tagline">Annual Subscription Invoice</div>
          </div>

          <div>
            <div class="invoice-title">INVOICE</div>
            <div class="invoice-number">${safeText(invoice.invoice_number)}</div>
          </div>
        </div>

        <div class="details-grid">
          <div class="detail-box">
            <div class="label">Bill To</div>
            <div class="company-name">${safeText(company.name || "Company")}</div>
            <div>${safeText(company.email || "")}</div>
            <div>${safeText(company.address || "")}</div>
          </div>

          <div class="detail-box">
            <div class="label">Invoice Details</div>
            <div><strong>Status:</strong> <span class="status-badge">${safeText(invoice.status || "draft")}</span></div>
            <div><strong>Issued:</strong> ${safeText(invoice.issued_at || "")}</div>
            <div><strong>Due:</strong> ${safeText(invoice.due_at || "")}</div>
          </div>
        </div>

        <div class="section">
          <div class="label">Billing Period</div>
          <div>
            ${safeText(invoice.period_start || "")}
            to
            ${safeText(invoice.period_end || "")}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="center">Qty</th>
              <th class="right">Unit Price</th>
              <th class="right">Amount</th>
            </tr>
          </thead>

          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="summary">
          <div class="summary-row">
            <span>Subtotal</span>
            <span>${formatMoney(invoice.subtotal_cents, currency)}</span>
          </div>

          <div class="summary-row">
            <span>Discount</span>
            <span>${formatMoney(invoice.discount_cents, currency)}</span>
          </div>

          <div class="summary-row total">
            <span>Total</span>
            <span>${formatMoney(invoice.total_cents, currency)}</span>
          </div>
        </div>

        <div class="footer">
          This invoice was generated by RizonHire.
        </div>
      </body>
    </html>
  `;
}

async function generatePdfFromHtml(env: InvoicePdfEnv, html: string) {
  const browser = await puppeteer.launch(env.BROWSER);

  try {
    const page = await browser.newPage();

    await page.setContent(html);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "15mm",
        right: "12mm",
        bottom: "15mm",
        left: "12mm"
      }
    });

    return pdf;
  } finally {
    await browser.close();
  }
}

export async function handleGenerateInvoicePdf(request: Request, env: InvoicePdfEnv) {
  if (!isAuthorized(request, env)) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: any;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const invoiceId = body.invoice_id;
  const companyId = body.company_id;
  const invoiceNumber = body.invoice_number;
  const payload = body.payload;

  if (!invoiceId || !companyId || !invoiceNumber || !payload) {
    return json(
      {
        error: "Missing invoice_id, company_id, invoice_number, or payload"
      },
      400
    );
  }

  if (!payload.invoice) {
    return json({ error: "Missing payload.invoice" }, 400);
  }

  const safeInvoiceNumber = sanitizeKeyPart(invoiceNumber);

  const pdfR2Key = `invoices/${companyId}/${invoiceId}/invoice-${safeInvoiceNumber}.pdf`;

  const html = buildInvoiceHtml(payload);

  const pdf = await generatePdfFromHtml(env, html);

  await env.INVOICE_BUCKET.put(pdfR2Key, pdf as any, {
    httpMetadata: {
      contentType: "application/pdf",
      contentDisposition: `inline; filename="invoice-${safeInvoiceNumber}.pdf"`
    },
    customMetadata: {
      invoice_id: String(invoiceId),
      company_id: String(companyId),
      invoice_number: String(invoiceNumber)
    }
  });

  const currentVersion = Number(payload.invoice.pdf_version || 0);
  const nextVersion = currentVersion + 1;

  return json({
    success: true,
    pdf_r2_key: pdfR2Key,
    pdf_version: nextVersion
  });
}

export async function handleGetInvoiceDownloadUrl(
  request: Request,
  env: InvoicePdfEnv,
  invoiceId: string
) {
  if (!isAuthorized(request, env)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const pdfR2Key = url.searchParams.get("key");

  if (!pdfR2Key) {
    return json({ error: "Missing invoice PDF key" }, 400);
  }

  if (!pdfR2Key.startsWith("invoices/")) {
    return json({ error: "Invalid invoice PDF key" }, 400);
  }

  if (!pdfR2Key.includes(`/${invoiceId}/`)) {
    return json({ error: "Invoice ID does not match PDF key" }, 400);
  }

  const existingObject = await env.INVOICE_BUCKET.head(pdfR2Key);

  if (!existingObject) {
    return json({ error: "Invoice PDF not found" }, 404);
  }

  const encodedKey = pdfR2Key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const r2Url = new URL(
    `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${INVOICE_BUCKET_NAME}/${encodedKey}`
  );

  r2Url.searchParams.set("X-Amz-Expires", String(SIGNED_URL_EXPIRY_SECONDS));

  const signer = new AwsClient({
    service: "s3",
    region: "auto",
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY
  });

  const signedRequest = await signer.sign(
    new Request(r2Url.toString(), {
      method: "GET"
    }),
    {
      aws: {
        signQuery: true
      }
    }
  );

  return json({
    success: true,
    url: signedRequest.url.toString(),
    expires_in: SIGNED_URL_EXPIRY_SECONDS
  });
}