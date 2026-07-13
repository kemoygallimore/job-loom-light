import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, Save, Send, Eye } from "lucide-react";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";

interface Template {
  id: string;
  key: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  variables: string[];
  is_active: boolean;
  updated_at: string;
}

export default function AdminEmailTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [preview, setPreview] = useState(false);
  const [sampleData, setSampleData] = useState<Record<string, string>>({});

  const selected = useMemo(() => templates.find((t) => t.id === selectedId) ?? null, [templates, selectedId]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .is("company_id", null)
        .order("name");
      if (error) {
        toast.error(error.message);
      } else {
        const list = (data ?? []) as Template[];
        setTemplates(list);
        setSelectedId(list[0]?.id ?? null);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    const next: Record<string, string> = {};
    for (const v of selected.variables ?? []) next[v] = sampleData[v] ?? `Sample ${v}`;
    setSampleData(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const render = (tpl: string) =>
    tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => sampleData[k] ?? `{{${k}}}`);

  const updateSelected = (patch: Partial<Template>) => {
    if (!selected) return;
    setTemplates((prev) => prev.map((t) => (t.id === selected.id ? { ...t, ...patch } : t)));
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("email_templates")
      .update({
        name: selected.name,
        subject: selected.subject,
        html_body: selected.html_body,
        text_body: selected.text_body,
        is_active: selected.is_active,
      })
      .eq("id", selected.id)
      .is("company_id", null);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Template saved");
  };

  const sendTest = async () => {
    if (!selected || !testEmail.trim()) {
      toast.error("Enter a test recipient email");
      return;
    }
    setSending(true);
    const { error } = await supabase.functions.invoke("send-candidate-email", {
      body: {
        mode: "test",
        template_key: selected.key,
        to: testEmail.trim(),
        variables: sampleData,
      },
    });
    setSending(false);
    if (error) toast.error(error.message);
    else toast.success(`Test sent to ${testEmail}`);
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email Templates</h1>
          <p className="text-sm text-muted-foreground">Manage candidate-facing email copy.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* List */}
        <Card className="p-2 h-fit">
          {templates.length === 0 && (
            <p className="text-sm text-muted-foreground p-3">No templates yet.</p>
          )}
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                selectedId === t.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              }`}
            >
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-muted-foreground font-mono">{t.key}</div>
              {!t.is_active && <div className="text-xs text-destructive mt-0.5">Disabled</div>}
            </button>
          ))}
        </Card>

        {/* Editor */}
        {selected && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{selected.name}</h2>
                <p className="text-xs text-muted-foreground font-mono">{selected.key}</p>
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-sm flex items-center gap-2">
                  Active
                  <Switch
                    checked={selected.is_active}
                    onCheckedChange={(v) => updateSelected({ is_active: v })}
                  />
                </Label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={selected.name} onChange={(e) => updateSelected({ name: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={selected.subject} onChange={(e) => updateSelected({ subject: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>HTML body</Label>
                <Button type="button" size="sm" variant="ghost" onClick={() => setPreview((p) => !p)}>
                  <Eye className="w-4 h-4 mr-1" /> {preview ? "Edit" : "Preview"}
                </Button>
              </div>
              {preview ? (
                <div
                  className="prose prose-sm max-w-none border rounded-md p-4 bg-card min-h-[200px]"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(render(selected.html_body)) }}
                />
              ) : (
                <Textarea
                  className="font-mono text-xs min-h-[220px]"
                  value={selected.html_body}
                  onChange={(e) => updateSelected({ html_body: e.target.value })}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Plain text body (optional)</Label>
              <Textarea
                className="font-mono text-xs min-h-[100px]"
                value={selected.text_body ?? ""}
                onChange={(e) => updateSelected({ text_body: e.target.value })}
              />
            </div>

            {selected.variables?.length > 0 && (
              <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Sample variables (used for preview & test sends)
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selected.variables.map((v) => (
                    <div key={v} className="space-y-1">
                      <Label className="text-xs font-mono">{`{{${v}}}`}</Label>
                      <Input
                        value={sampleData[v] ?? ""}
                        onChange={(e) => setSampleData((p) => ({ ...p, [v]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3 pt-2 border-t">
              <div className="space-y-1.5 flex-1 min-w-[220px]">
                <Label>Send test to</Label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </div>
              <Button type="button" variant="outline" onClick={sendTest} disabled={sending}>
                <Send className="w-4 h-4 mr-1" /> {sending ? "Sending…" : "Send test"}
              </Button>
              <Button type="button" onClick={save} disabled={saving}>
                <Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
