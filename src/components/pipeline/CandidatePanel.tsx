import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Application } from "@/pages/Pipeline";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Mail, User, Briefcase, Clock } from "lucide-react";
import { toast } from "sonner";
import InterviewFeedback from "@/components/candidate/InterviewFeedback";

const STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;

interface Note {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
}

interface Props {
  app: Application;
  onClose: () => void;
  onStageChange: (stage: string) => void;
}

export default function CandidatePanel({ app, onClose, onStageChange }: Props) {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");

  useEffect(() => {
    const fetchNotes = async () => {
      const { data } = await supabase
        .from("notes")
        .select("*")
        .eq("candidate_id", app.candidate_id)
        .order("created_at", { ascending: false });
      setNotes((data as Note[]) ?? []);
    };
    fetchNotes();
  }, [app.candidate_id]);

  const addNote = async () => {
    if (!profile || !newNote.trim()) return;
    const { error } = await supabase.from("notes").insert({
      company_id: profile.company_id,
      candidate_id: app.candidate_id,
      user_id: profile.user_id,
      content: newNote.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setNewNote("");
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("candidate_id", app.candidate_id)
      .order("created_at", { ascending: false });
    setNotes((data as Note[]) ?? []);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l shadow-xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-lg truncate">{app.candidate?.name}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted transition-colors active:scale-95">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Briefcase className="w-4 h-4" />
              <span>{app.job?.title}</span>
            </div>
            {app.candidate?.email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span>{app.candidate.email}</span>
              </div>
            )}
          </div>

          {/* Stage selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Stage</label>
            <Select value={app.stage} onValueChange={onStageChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map(s => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes</h3>
            <div className="flex gap-2">
              <Textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="flex-1 text-sm"
              />
              <Button onClick={addNote} disabled={!newNote.trim()} size="sm" className="self-end">
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {notes.map(n => (
                <div key={n.id} className="bg-muted rounded-lg p-3">
                  <div className="text-sm">{n.content}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
                    <Clock className="w-3 h-3" />
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
              {notes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No notes yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </>
  );
}
