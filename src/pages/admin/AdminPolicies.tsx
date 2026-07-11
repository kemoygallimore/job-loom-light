import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import { toast } from "sonner";
import { Save, Plus, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface PolicyRow {
  key: string;
  title: string;
  content_html: string | null;
  updated_at: string;
}

export default function AdminPolicies() {
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async (preserveKey?: string) => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("platform_policies")
      .select("key, title, content_html, updated_at")
      .order("title");
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const rows = (data ?? []) as PolicyRow[];
    setPolicies(rows);
    const next = preserveKey ?? activeKey ?? rows[0]?.key ?? null;
    setActiveKey(next);
    const current = rows.find((r) => r.key === next);
    if (current) {
      setTitle(current.title);
      setHtml(current.content_html ?? "");
    }
  }, [activeKey]);

  useEffect(() => { refresh(); }, []);

  const selectPolicy = (key: string) => {
    const row = policies.find((p) => p.key === key);
    if (!row) return;
    setActiveKey(key);
    setTitle(row.title);
    setHtml(row.content_html ?? "");
  };

  const save = async () => {
    if (!activeKey) return;
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any)
      .from("platform_policies")
      .update({ title: title.trim(), content_html: html, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq("key", activeKey);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Policy saved");
    refresh(activeKey);
  };

  const createPolicy = async () => {
    const k = newKey.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    if (!k || !newTitle.trim()) { toast.error("Key and title are required"); return; }
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any)
      .from("platform_policies")
      .insert({ key: k, title: newTitle.trim(), content_html: "", updated_by: user?.id });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Policy created");
    setCreateOpen(false);
    setNewKey(""); setNewTitle("");
    refresh(k);
  };

  const current = policies.find((p) => p.key === activeKey);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-3 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Platform Policies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Global policies maintained by RizonHire. Visible to every tenant and on public application pages.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New policy
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 animate-fade-in">
        <aside className="rounded-xl border bg-card p-2 h-fit">
          {loading && policies.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">Loading…</div>
          ) : policies.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">No policies yet</div>
          ) : (
            <ul className="space-y-0.5">
              {policies.map((p) => (
                <li key={p.key}>
                  <button
                    onClick={() => selectPolicy(p.key)}
                    className={`w-full text-left rounded-md px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                      p.key === activeKey ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                    <span className="truncate">{p.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="rounded-xl border bg-card p-6 space-y-4 max-w-3xl">
          {!current ? (
            <p className="text-sm text-muted-foreground">Select a policy to edit, or create a new one.</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Policy key</p>
                  <code className="text-sm font-mono">{current.key}</code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last saved {new Date(current.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Content</Label>
                <RichTextEditor value={html} onChange={setHtml} />
              </div>
              <Button onClick={save} disabled={saving}>
                <Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Save policy"}
              </Button>
              {current.key === "data_protection" && (
                <p className="text-xs text-muted-foreground">
                  This policy is shown to candidates on public application pages and to all signed-in users via
                  Account → Data Protection.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New platform policy</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Key</Label>
              <Input
                placeholder="e.g. terms_of_service"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Lowercase, letters/numbers/underscores. Used as an identifier — cannot be changed later.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Title</Label>
              <Input
                placeholder="e.g. Terms of Service"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createPolicy} disabled={creating}>{creating ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
