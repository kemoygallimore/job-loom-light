import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_DATA_PROTECTION_HTML } from "@/lib/defaultDataProtection";

export default function DataProtection() {
  const [title, setTitle] = useState<string>("Data Protection Agreement");
  const [html, setHtml] = useState<string>(DEFAULT_DATA_PROTECTION_HTML);
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date());

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).rpc("get_public_platform_policy", { _key: "data_protection" });
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        if (row.title) setTitle(row.title);
        if (row.content_html) setHtml(row.content_html);
        if (row.updated_at) setUpdatedAt(new Date(row.updated_at));
      }
    })();
  }, []);

  const safe = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Last updated: {updatedAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full">
        <div
          className="prose prose-sm sm:prose-base max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary"
          dangerouslySetInnerHTML={{ __html: safe }}
        />
      </main>

      <footer className="border-t mt-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-center">
          <p className="text-xs text-muted-foreground/50">
            Powered by <span className="font-medium">RizonHire</span>
          </p>
        </div>
      </footer>
    </div>
  );
}