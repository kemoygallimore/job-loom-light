// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = Deno.env.get("RIZONHIRE_FROM_EMAIL") ?? "RizonHire <no-reply@rizonhire.com>";

function render(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { template_key, to, variables = {}, company_id, application_id, test = false } = body ?? {};

    if (!template_key || !to) {
      return new Response(JSON.stringify({ error: "template_key and to are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: tpl, error: tplErr } = await admin
      .from("email_templates")
      .select("subject, html_body, text_body, is_active")
      .eq("key", template_key)
      .maybeSingle();

    if (tplErr || !tpl) {
      return new Response(JSON.stringify({ error: "Template not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!tpl.is_active && !test) {
      return new Response(JSON.stringify({ error: "Template is disabled" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = render(tpl.subject, variables);
    const html = render(tpl.html_body, variables);
    const text = tpl.text_body ? render(tpl.text_body, variables) : undefined;

    // Resolve sender per company (Stage 7)
    let fromAddress = FROM_ADDRESS;
    let replyTo: string | undefined;
    if (company_id) {
      const { data: co } = await admin
        .from("companies")
        .select("name, email_domain, email_domain_status, email_from_name, email_reply_to")
        .eq("id", company_id)
        .maybeSingle();
      if (co?.email_domain && co.email_domain_status === "verified") {
        const displayName = (co.email_from_name || co.name || "Careers").replace(/[<>"]/g, "");
        fromAddress = `${displayName} <no-reply@${co.email_domain}>`;
        replyTo = co.email_reply_to || undefined;
      }
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: fromAddress, to: [to], subject, html, text, reply_to: replyTo }),
    });

    const resendData = await resendRes.json().catch(() => ({} as any));

    if (!resendRes.ok) {
      await admin.from("email_send_log").insert({
        template_key, recipient_email: to, company_id: company_id ?? null,
        application_id: application_id ?? null, status: "failed",
        error_message: JSON.stringify(resendData).slice(0, 1000), context: variables,
        from_address: fromAddress, reply_to: replyTo ?? null,
      });
      return new Response(JSON.stringify({ error: "Resend failed", details: resendData }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("email_send_log").insert({
      template_key, recipient_email: to, company_id: company_id ?? null,
      application_id: application_id ?? null, status: "sent",
      provider_message_id: resendData?.id ?? null, context: variables,
      from_address: fromAddress, reply_to: replyTo ?? null,
    });

    return new Response(JSON.stringify({ ok: true, id: resendData?.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
