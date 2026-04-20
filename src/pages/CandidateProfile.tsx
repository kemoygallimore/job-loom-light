import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Mail, Phone, FileText, Briefcase, Calendar, Clock, User, RotateCcw, MapPin, GraduationCap } from "lucide-react";
import CandidateNotes, { type NoteWithAuthor } from "@/components/candidate/CandidateNotes";
import ActivityTimeline, { type TimelineEvent } from "@/components/candidate/ActivityTimeline";
import InterviewFeedback from "@/components/candidate/InterviewFeedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ResumeHistory from "@/components/candidate/ResumeHistory";

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
  resume_bucket: string | null;
  resume_object_key: string | null;
  created_at: string;
  company_id: string;
  country: string | null;
  street_address: string | null;
  parish_state: string | null;
  education_level: string | null;
}

interface ApplicationWithJob {
  id: string;
  stage: string;
  updated_at: string;
  created_at: string;
  job_id: string;
  job_title: string;
  hiring_manager: string | null;
}

export default function CandidateProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);
  const [notes, setNotes] = useState<NoteWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !profile) return;
    const load = async () => {
      setLoading(true);
      const [cRes, aRes, nRes] = await Promise.all([
        supabase.from("candidates").select("*").eq("id", id).single(),
        supabase
          .from("applications")
          .select("id, stage, updated_at, created_at, job_id, jobs(title, hiring_manager)")
          .eq("candidate_id", id)
          .order("updated_at", { ascending: false }),
        supabase.from("notes").select("*").eq("candidate_id", id).order("created_at", { ascending: false }),
      ]);

      if (cRes.error || !cRes.data) {
        toast.error("Candidate not found");
        navigate("/candidates");
        return;
      }

      const rawNotes = (nRes.data ?? []) as any[];

      // Fetch author names for notes
      const authorIds = [...new Set(rawNotes.map((n: any) => n.user_id))];
      let authorMap: Record<string, string> = {};
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, name").in("user_id", authorIds);
        (profiles ?? []).forEach((p: any) => {
          authorMap[p.user_id] = p.name;
        });
      }

      setCandidate(cRes.data as Candidate);
      setApplications(
        (aRes.data ?? []).map((a: any) => ({
          id: a.id,
          stage: a.stage,
          updated_at: a.updated_at,
          created_at: a.created_at,
          job_id: a.job_id,
          job_title: a.jobs?.title ?? "Unknown",
          hiring_manager: a.jobs?.hiring_manager ?? null,
        })),
      );
      setNotes(
        rawNotes.map((n: any) => ({
          id: n.id,
          content: n.content,
          created_at: n.created_at,
          user_id: n.user_id,
          author_name: authorMap[n.user_id] ?? "Unknown",
        })),
      );
      setLoading(false);
    };
    load();
  }, [id, profile]);

  const handleStageChange = async (appId: string, newStage: string) => {
    const { error } = await supabase
      .from("applications")
      .update({ stage: newStage as any })
      .eq("id", appId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Stage updated to ${newStage}`);
    setApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, stage: newStage, updated_at: new Date().toISOString() } : a)),
    );
  };

  // Build activity timeline events
  const buildTimeline = (): TimelineEvent[] => {
    if (!candidate) return [];
    const events: TimelineEvent[] = [];

    // Candidate created
    events.push({
      id: "created-" + candidate.id,
      type: "created",
      title: "Candidate profile created",
      timestamp: candidate.created_at,
    });

    // Resume uploaded
    if (candidate.resume_url) {
      events.push({
        id: "resume-" + candidate.id,
        type: "resume",
        title: "Resume uploaded",
        timestamp: candidate.created_at,
      });
    }

    // Applications
    applications.forEach((app) => {
      events.push({
        id: "app-" + app.id,
        type: "applied",
        title: `Applied for ${app.job_title}`,
        description: `Current stage: ${app.stage}`,
        timestamp: app.created_at,
      });
    });

    // Notes
    notes.forEach((n) => {
      events.push({
        id: "note-" + n.id,
        type: "note",
        title: "Note added",
        description: n.content.length > 120 ? n.content.slice(0, 120) + "…" : n.content,
        timestamp: n.created_at,
        meta: n.author_name,
      });
    });

    // Sort newest first
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return events;
  };

  const latestApp = applications[0] ?? null;
  const isRepeatApplicant = applications.length > 1;

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <div className="bg-card border rounded-xl p-6 space-y-4">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="bg-card border rounded-xl p-6 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!candidate) return null;

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/candidates")}
        className="gap-2 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Candidates
      </Button>

      {/* Header card */}
      <div className="bg-card border rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold leading-tight">{candidate.name}</h1>
                  {isRepeatApplicant && (
                    <Badge
                      variant="outline"
                      className="gap-1 text-xs font-medium border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Repeat Applicant
                    </Badge>
                  )}
                </div>
                {latestApp && <p className="text-sm text-muted-foreground mt-0.5">{latestApp.job_title}</p>}
              </div>
            </div>
            {latestApp && (
              <Badge
                variant="secondary"
                className={`capitalize text-xs font-medium ${STAGE_COLORS[latestApp.stage] ?? ""}`}
              >
                {latestApp.stage}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {candidate.email && (
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <a href={`mailto:${candidate.email}`} className="text-primary hover:underline truncate">
                  {candidate.email}
                </a>
              </div>
            )}
            {candidate.phone && (
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">{candidate.phone}</span>
              </div>
            )}
            {(candidate.street_address || candidate.parish_state || candidate.country) && (
              <div className="flex items-center gap-2.5 text-sm sm:col-span-2">
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">
                  {[candidate.street_address, candidate.parish_state, candidate.country].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
            {candidate.education_level && (
              <div className="flex items-center gap-2.5 text-sm">
                <GraduationCap className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">{candidate.education_level}</span>
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

          <div className="flex items-center gap-2 flex-wrap">
            {candidate.resume_url && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={async () => {
                  try {
                    const bucket = candidate.resume_bucket ?? "silverweb-ats-resumes";
                    const key = candidate.resume_object_key ?? candidate.resume_url;

                    if (!key) {
                      throw new Error("Resume not found");
                    }

                    const res = await fetch("https://api.rizonhire.com/sign-view", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        bucket,
                        key,
                      }),
                    });

                    if (!res.ok) {
                      throw new Error("Failed to get signed resume URL");
                    }

                    const data = await res.json();

                    if (!data.viewUrl) {
                      throw new Error("Invalid response from Worker");
                    }

                    window.open(data.viewUrl, "_blank", "noopener,noreferrer");
                  } catch (err: any) {
                    console.error(err);
                    toast.error(err?.message || "Failed to load resume");
                  }
                }}
              >
                <FileText className="w-4 h-4" />
                View Resume
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Application History */}
      {applications.length > 0 && (
        <div className="bg-card border rounded-xl p-6 space-y-4" style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Application History
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {applications.length} application{applications.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="relative">
            {applications.length > 1 && <div className="absolute left-[15px] top-6 bottom-6 w-px bg-border" />}
            <div className="space-y-0">
              {applications.map((app, index) => {
                const isLatest = index === 0;
                return (
                  <div key={app.id} className="relative flex gap-4 py-3">
                    <div className="relative z-10 flex-shrink-0 mt-0.5">
                      <div
                        className={`w-[30px] h-[30px] rounded-full flex items-center justify-center ${isLatest ? "bg-primary/10 ring-2 ring-primary/20" : "bg-muted"}`}
                      >
                        <Briefcase className={`w-3.5 h-3.5 ${isLatest ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                    </div>
                    <div
                      className={`flex-1 rounded-lg p-3 ${isLatest ? "bg-primary/5 border border-primary/10" : "bg-muted/50"}`}
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-sm font-medium truncate ${isLatest ? "text-foreground" : "text-foreground/80"}`}
                            >
                              {app.job_title}
                            </span>
                            {isLatest && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                Latest
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Applied {new Date(app.created_at).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Updated {new Date(app.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={`capitalize text-xs font-medium ${STAGE_COLORS[app.stage] ?? ""}`}
                          >
                            {app.stage}
                          </Badge>
                          <Select value={app.stage} onValueChange={(v) => handleStageChange(app.id, v)}>
                            <SelectTrigger className="w-[120px] h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STAGES.map((s) => (
                                <SelectItem key={s} value={s} className="capitalize text-xs">
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tabs: Notes / Interview Feedback / Resume History */}
      <Tabs defaultValue="notes" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="feedback">Interview Feedback</TabsTrigger>
          <TabsTrigger value="resumes">Resume History</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-4">
          <CandidateNotes
            candidateId={candidate.id}
            companyId={candidate.company_id}
            userId={profile!.user_id}
            notes={notes}
            onNotesChange={setNotes}
          />
        </TabsContent>

        <TabsContent value="feedback" className="mt-4">
          <InterviewFeedback
            candidateId={candidate.id}
            companyId={candidate.company_id}
            userId={profile!.user_id}
            jobs={applications.map((a) => ({
              id: a.job_id,
              title: a.job_title,
              hiring_manager: a.hiring_manager,
            }))}
            defaultJobId={latestApp?.job_id}
            currentUserName={profile?.name}
          />
        </TabsContent>

        <TabsContent value="resumes" className="mt-4">
          <div className="bg-card border rounded-xl p-6" style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Resume History
            </h2>
            <ResumeHistory candidateId={candidate.id} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Standalone Activity Timeline */}
      <ActivityTimeline events={buildTimeline()} />
    </div>
  );
}
