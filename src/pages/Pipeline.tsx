import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, MessageSquare, ChevronRight } from "lucide-react";

const STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;
type Stage = typeof STAGES[number];

interface Application {
  id: string;
  job_id: string;
  candidate_id: string;
  stage: Stage;
  company_id: string;
  candidate: { name: string; email: string | null };
  job: { title: string };
}

interface Note {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
}

export default function Pipeline() {
  const { profile } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
  const [candidates, setCandidates] = useState<{ id: string; name: string }[]>([]);
  const [selectedJobFilter, setSelectedJobFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [newJobId, setNewJobId] = useState("");
  const [newCandidateId, setNewCandidateId] = useState("");

  // Notes state
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesCandidateId, setNotesCandidateId] = useState<string | null>(null);
  const [notesCandidateName, setNotesCandidateName] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("applications")
      .select("id, job_id, candidate_id, stage, company_id, candidates(name, email), jobs(title)")
      .order("created_at", { ascending: false });

    const mapped = (data ?? []).map((d: any) => ({
      ...d,
      candidate: d.candidates,
      job: d.jobs,
    }));
    setApplications(mapped as Application[]);
  };

  const loadOptions = async () => {
    const [j, c] = await Promise.all([
      supabase.from("jobs").select("id, title").eq("status", "open"),
      supabase.from("candidates").select("id, name"),
    ]);
    setJobs((j.data as any[]) ?? []);
    setCandidates((c.data as any[]) ?? []);
  };

  useEffect(() => { if (profile) { load(); loadOptions(); } }, [profile]);

  const moveStage = async (appId: string, newStage: Stage) => {
    const { error } = await supabase.from("applications").update({ stage: newStage }).eq("id", appId);
    if (error) { toast.error(error.message); return; }
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, stage: newStage } : a));
  };

  const createApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const { error } = await supabase.from("applications").insert({
      company_id: profile.company_id,
      job_id: newJobId,
      candidate_id: newCandidateId,
      stage: "applied" as Stage,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Application created");
    setCreateOpen(false);
    setNewJobId("");
    setNewCandidateId("");
    load();
  };

  const openNotes = async (candidateId: string, candidateName: string) => {
    setNotesCandidateId(candidateId);
    setNotesCandidateName(candidateName);
    setNotesOpen(true);
    const { data } = await supabase.from("notes").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: false });
    setNotes((data as Note[]) ?? []);
  };

  const addNote = async () => {
    if (!profile || !notesCandidateId || !newNote.trim()) return;
    const { error } = await supabase.from("notes").insert({
      company_id: profile.company_id,
      candidate_id: notesCandidateId,
      user_id: profile.user_id,
      content: newNote.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setNewNote("");
    const { data } = await supabase.from("notes").select("*").eq("candidate_id", notesCandidateId).order("created_at", { ascending: false });
    setNotes((data as Note[]) ?? []);
  };

  const filtered = selectedJobFilter === "all" ? applications : applications.filter(a => a.job_id === selectedJobFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Hiring Pipeline</h1>
        <div className="flex items-center gap-3">
          <Select value={selectedJobFilter} onValueChange={setSelectedJobFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filter by job" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jobs</SelectItem>
              {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />New Application</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Application</DialogTitle></DialogHeader>
              <form onSubmit={createApplication} className="space-y-4">
                <div className="space-y-2">
                  <Label>Job</Label>
                  <Select value={newJobId} onValueChange={setNewJobId}>
                    <SelectTrigger><SelectValue placeholder="Select job" /></SelectTrigger>
                    <SelectContent>
                      {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Candidate</Label>
                  <Select value={newCandidateId} onValueChange={setNewCandidateId}>
                    <SelectTrigger><SelectValue placeholder="Select candidate" /></SelectTrigger>
                    <SelectContent>
                      {candidates.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={!newJobId || !newCandidateId}>Create</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageApps = filtered.filter(a => a.stage === stage);
          return (
            <div key={stage} className="kanban-column">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold capitalize">{stage}</h3>
                <span className="text-xs text-muted-foreground tabular-nums">{stageApps.length}</span>
              </div>
              <div className="space-y-2">
                {stageApps.map(app => {
                  const stageIdx = STAGES.indexOf(app.stage);
                  const nextStage = stageIdx < STAGES.length - 1 ? STAGES[stageIdx + 1] : null;
                  return (
                    <div key={app.id} className="kanban-card">
                      <div className="font-medium text-sm">{app.candidate?.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{app.job?.title}</div>
                      <div className="flex items-center gap-1 mt-2">
                        {nextStage && app.stage !== "rejected" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => moveStage(app.id, nextStage)}>
                            <ChevronRight className="w-3 h-3 mr-1" />{nextStage}
                          </Button>
                        )}
                        {app.stage !== "rejected" && app.stage !== "hired" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-destructive" onClick={() => moveStage(app.id, "rejected")}>
                            Reject
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs px-2 ml-auto" onClick={() => openNotes(app.candidate_id, app.candidate?.name)}>
                          <MessageSquare className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {stageApps.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-4">No candidates</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Notes dialog */}
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Notes — {notesCandidateName}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {notes.map(n => (
              <div key={n.id} className="bg-muted rounded-lg p-3 text-sm">
                <div>{n.content}</div>
                <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
              </div>
            ))}
            {notes.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">No notes yet</div>}
          </div>
          <div className="flex gap-2">
            <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..." rows={2} className="flex-1" />
            <Button onClick={addNote} disabled={!newNote.trim()}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
