import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Mail, Phone, FileText, Briefcase, Calendar, Clock, User, Plus,
} from "lucide-react";

const STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;

const STAGE_COLORS: Record<string, string> = {
  applied: "bg-muted text-muted-foreground",
  screening: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  interview: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  offer: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  hired: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

interface Candidate {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  resume_url: string | null;
  created_at: string;
  company_id: string;
}

interface ApplicationWithJob {
  id: string;
  stage: string;
  updated_at: string;
  job_id: string;
  job_title: string;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
}

export default function CandidateProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [noteSaving, setNoteSaving] = useState(false);

  useEffect(() => {
    if (!id || !profile) return;
    const load = async () => {
      setLoading(true);
      const [cRes, aRes, nRes] = await Promise.all([
        supabase.from("candidates").select("*").eq("id", id).single(),
        supabase.from("applications").select("id, stage, updated_at, job_id, jobs(title)").eq("candidate_id", id).order("updated_at", { ascending: false }),
        supabase.from("notes").select("*").eq("candidate_id", id).order("created_at", { ascending: false }),
      ]);

      if (cRes.error || !cRes.data) {
        toast.error("Candidate not found");
        navigate("/candidates");
        return;
      }
      setCandidate(cRes.data as Candidate);
      setApplications(
        (aRes.data ?? []).map((a: any) => ({
          id: a.id,
          stage: a.stage,
          updated_at: a.updated_at,
          job_id: a.job_id,
          job_title: a.jobs?.title ?? "Unknown",
        }))
      );
      setNotes((nRes.data as Note[]) ?? []);
      setLoading(false);
    };
    load();
  }, [id, profile]);

  const handleStageChange = async (appId: string, newStage: string) => {
    const { error } = await supabase.from("applications").update({ stage: newStage }).eq("id", appId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Stage updated to ${newStage}`);
    setApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, stage: newStage, updated_at: new Date().toISOString() } : a))
    );
  };

  const addNote = async () => {
    if (!profile || !newNote.trim() || !candidate) return;
    setNoteSaving(true);
    const { error } = await supabase.from("notes").insert({
      company_id: profile.company_id,
      candidate_id: candidate.id,
      user_id: profile.user_id,
      content: newNote.trim(),
    });
    if (error) { toast.error(error.message); setNoteSaving(false); return; }
    toast.success("Note added");
    setNewNote("");
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("candidate_id", candidate.id)
      .order("created_at", { ascending: false });
    setNotes((data as Note[]) ?? []);
    setNoteSaving(false);
  };

  const latestApp = applications[0] ?? null;

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <div className="bg-card border rounded-xl p-6 space-y-4">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="bg-card border rounded-xl p-6 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (!candidate) return null;

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/candidates")} className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" />
        Back to Candidates
      </Button>

      {/* Header card */}
      <div className="bg-card border rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
        <div className="p-6 space-y-5">
          {/* Name + stage */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight">{candidate.name}</h1>
                {latestApp && (
                  <p className="text-sm text-muted-foreground mt-0.5">{latestApp.job_title}</p>
                )}
              </div>
            </div>
            {latestApp && (
              <Badge variant="secondary" className={`capitalize text-xs font-medium ${STAGE_COLORS[latestApp.stage] ?? ""}`}>
                {latestApp.stage}
              </Badge>
            )}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {candidate.email && (
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <a href={`mailto:${candidate.email}`} className="text-primary hover:underline truncate">{candidate.email}</a>
              </div>
            )}
            {candidate.phone && (
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">{candidate.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2.5 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Added {new Date(candidate.created_at).toLocaleDateString()}</span>
            </div>
            {!candidate.email && !candidate.phone && (
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span>No contact info</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {candidate.resume_url && (
              <a href={candidate.resume_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-2">
                  <FileText className="w-4 h-4" />
                  View Resume
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Applications */}
      {applications.length > 0 && (
        <div className="bg-card border rounded-xl p-6 space-y-4" style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Applications</h2>
          <div className="space-y-3">
            {applications.map((app) => (
              <div key={app.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{app.job_title}</span>
                  <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                    {new Date(app.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <Select value={app.stage} onValueChange={(v) => handleStageChange(app.id, v)}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
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
          <Button onClick={addNote} disabled={!newNote.trim() || noteSaving} size="sm" className="self-end gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="bg-muted rounded-lg p-3">
              <p className="text-sm">{n.content}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
                <Clock className="w-3 h-3" />
                {new Date(n.created_at).toLocaleString()}
              </div>
            </div>
          ))}
          {notes.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No notes yet. Add your first note above.</p>
          )}
        </div>
      </div>
    </div>
  );
}
