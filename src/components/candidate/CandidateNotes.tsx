import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Plus, User } from "lucide-react";
import { toast } from "sonner";

export interface NoteWithAuthor {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  author_name: string;
}

interface Props {
  candidateId: string;
  companyId: string;
  userId: string;
  notes: NoteWithAuthor[];
  onNotesChange: (notes: NoteWithAuthor[]) => void;
}

export default function CandidateNotes({ candidateId, companyId, userId, notes, onNotesChange }: Props) {
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  const addNote = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("notes").insert({
      company_id: companyId,
      candidate_id: candidateId,
      user_id: userId,
      content: newNote.trim(),
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Note added");
    setNewNote("");

    // Refetch with author
    const { data } = await supabase
      .from("notes")
      .select("id, content, created_at, user_id, profiles!notes_company_id_fkey(name)")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false });

    // Fallback: fetch without join if the above fails
    if (!data) {
      const { data: plain } = await supabase
        .from("notes")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false });
      onNotesChange((plain ?? []).map((n: any) => ({ ...n, author_name: "Unknown" })));
    } else {
      onNotesChange(data.map((n: any) => ({
        id: n.id,
        content: n.content,
        created_at: n.created_at,
        user_id: n.user_id,
        author_name: (n.profiles as any)?.name ?? "Unknown",
      })));
    }
    setSaving(false);
  };

  return (
    <div className="bg-card border rounded-xl p-6 space-y-4" style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</h2>
      <div className="flex gap-2">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note about this candidate..."
          rows={2}
          className="flex-1 text-sm"
        />
        <Button onClick={addNote} disabled={!newNote.trim() || saving} size="sm" className="self-end gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>
      <div className="space-y-2">
        {notes.map((n) => (
          <div key={n.id} className="bg-muted rounded-lg p-3">
            <p className="text-sm">{n.content}</p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {n.author_name}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(n.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
        {notes.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No notes yet. Add your first note above.</p>
        )}
      </div>
    </div>
  );
}
