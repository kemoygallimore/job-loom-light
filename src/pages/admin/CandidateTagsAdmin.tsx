import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tag as TagIcon } from "lucide-react";
import { TAG_COLORS, getTagColorClasses, type CandidateTag } from "@/lib/candidateTags";
import { Navigate } from "react-router-dom";

export default function CandidateTagsAdmin() {
  const { profile, role, loading } = useAuth();
  const [tags, setTags] = useState<CandidateTag[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CandidateTag | null>(null);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState<string>(TAG_COLORS[0].value);

  const load = async () => {
    if (!profile?.company_id) return;
    const { data, error } = await (supabase as any)
      .from("candidate_tags")
      .select("id, company_id, label, color")
      .eq("company_id", profile.company_id)
      .order("label");
    if (error) { toast.error(error.message); return; }
    setTags((data as CandidateTag[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.company_id]);

  if (loading) return null;
  if (role !== "admin") return <Navigate to="/dashboard" replace />;

  const reset = () => {
    setEditing(null);
    setLabel("");
    setColor(TAG_COLORS[0].value);
    setOpen(false);
  };

  const startEdit = (tag: CandidateTag) => {
    setEditing(tag);
    setLabel(tag.label);
    setColor(tag.color);
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id || !label.trim()) return;
    if (editing) {
      const { error } = await (supabase as any)
        .from("candidate_tags")
        .update({ label: label.trim(), color })
        .eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Tag updated");
    } else {
      const { error } = await (supabase as any)
        .from("candidate_tags")
        .insert({
          company_id: profile.company_id,
          label: label.trim(),
          color,
          created_by: profile.user_id,
        });
      if (error) { toast.error(error.message); return; }
      toast.success("Tag created");
    }
    reset();
    load();
  };

  const remove = async (tag: CandidateTag) => {
    if (!confirm(`Delete tag "${tag.label}"? It will be removed from all candidates.`)) return;
    const { error } = await (supabase as any)
      .from("candidate_tags")
      .delete()
      .eq("id", tag.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Tag deleted");
    load();
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Candidate Tags</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Reusable flags (e.g. "Do not hire", "Top talent") applied across all candidates.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />New Tag</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit Tag" : "New Tag"}</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Do not hire" required />
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {TAG_COLORS.map(c => (
                    <button
                      type="button"
                      key={c.value}
                      onClick={() => setColor(c.value)}
                      className={`inline-flex items-center rounded-full border text-xs px-2.5 py-1 font-medium transition-all ${c.classes} ${color === c.value ? "ring-2 ring-ring ring-offset-1" : ""}`}
                    >
                      {label.trim() || c.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full">{editing ? "Save" : "Create"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border rounded-xl p-4">
        {tags.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <TagIcon className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm">No tags yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tags.map(tag => (
              <div key={tag.id} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted/50">
                <span className={`inline-flex items-center rounded-full border text-xs px-2.5 py-0.5 font-medium ${getTagColorClasses(tag.color)}`}>
                  {tag.label}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(tag)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(tag)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}