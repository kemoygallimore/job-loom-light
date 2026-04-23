import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Application } from "@/pages/Pipeline";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Mail, Briefcase, Clock, Link2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import InterviewFeedback from "@/components/candidate/InterviewFeedback";
import CandidateTagsBar from "@/components/candidate/CandidateTagsBar";

const STAGES = ["applied", "shortlisted", "screening", "scheduling", "1st_interview", "2nd_interview", "offer", "hired", "rejected"] as const;

const STAGE_LABELS: Record<string, string> = {
  applied: "Applied",
  shortlisted: "Shortlisted",
  screening: "Screening",
  scheduling: "Scheduling",
  "1st_interview": "1st Interview",
  "2nd_interview": "2nd Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};

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
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const generateFeedbackLink = async () => {
    if (!profile) return;
    setGeneratingLink(true);
    const { data, error } = await (supabase as any)
      .from("feedback_links")
      .insert({
        company_id: profile.company_id,
        candidate_id: app.candidate_id,
        job_id: app.job_id,
        application_id: app.id,
        created_by: profile.user_id,
      })
      .select("token")
      .single();
    setGeneratingLink(false);
    if (error || !data) {
      toast.error(error?.message ?? "Failed to generate link");
      return;
    }
    const url = `${window.location.origin}/feedback/${data.token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Panelist feedback link copied to clipboard");
    setTimeout(() => setCopied(false), 2500);
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
            <CandidateTagsBar candidateId={app.candidate_id} />
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
                  <SelectItem key={s} value={s}>{STAGE_LABELS[s] ?? s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabs: Notes / Interview Feedback */}
          <Tabs defaultValue="notes" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="feedback">Interview Feedback</TabsTrigger>
            </TabsList>

            <TabsContent value="notes" className="space-y-3 mt-4">
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
            </TabsContent>

            <TabsContent value="feedback" className="mt-4">
              <div className="mb-3 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={generateFeedbackLink}
                  disabled={generatingLink}
                  className="gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Link2 className="w-3.5 h-3.5" />}
                  {generatingLink ? "Generating…" : copied ? "Link copied" : "Generate Panel Feedback Link"}
                </Button>
              </div>
              {profile && (
                <InterviewFeedback
                  candidateId={app.candidate_id}
                  companyId={profile.company_id}
                  userId={profile.user_id}
                  jobs={
                    app.job
                      ? [{ id: app.job_id, title: app.job.title, hiring_manager: app.job.hiring_manager }]
                      : []
                  }
                  defaultJobId={app.job_id}
                  currentUserName={profile.name}
                />
              )}
            </TabsContent>
          </Tabs>
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
