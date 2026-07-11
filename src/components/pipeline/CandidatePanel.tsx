import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Application } from "@/pages/Pipeline";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Briefcase,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  GraduationCap,
  Link2,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Send,
  User,
  X,
  XCircle,
} from "lucide-react";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { toast } from "sonner";
import InterviewFeedback from "@/components/candidate/InterviewFeedback";
import CandidateTagsBar from "@/components/candidate/CandidateTagsBar";
import ResumeHistory from "@/components/candidate/ResumeHistory";
import CandidateDocuments from "@/components/candidate/CandidateDocuments";
import ActivityTimeline from "@/components/candidate/ActivityTimeline";
import { CandidateEmailComposer } from "@/components/email/CandidateEmailComposer";
import { buildPipelineCandidateTimeline } from "@/lib/pipeline";
import ScreeningReview from "@/components/candidate/ScreeningReview";
import CandidateForms from "@/components/candidate/CandidateForms";

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

const STAGE_COLORS: Record<string, string> = {
  applied: "bg-muted text-muted-foreground",
  shortlisted: "bg-emerald-100 text-emerald-700",
  screening: "bg-blue-100 text-blue-700",
  scheduling: "bg-cyan-100 text-cyan-700",
  "1st_interview": "bg-violet-100 text-violet-700",
  "2nd_interview": "bg-fuchsia-100 text-fuchsia-700",
  offer: "bg-purple-100 text-purple-700",
  hired: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

interface CandidateDetails {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  street_address: string | null;
  parish_state: string | null;
  education_level: string | null;
  linkedin_url: string | null;
  created_at: string;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
}

interface ApplicationHistoryRow {
  id: string;
  stage: string;
  updated_at: string;
  created_at: string;
  job_id: string;
  jobs: { title: string | null; status: string | null; hiring_manager: string | null } | null;
}

interface ApplicationHistoryItem {
  id: string;
  stage: string;
  updated_at: string;
  created_at: string;
  job_id: string;
  job_title: string;
  job_status: string | null;
  hiring_manager: string | null;
}

interface EmailLog {
  id: string;
  template_key: string;
  context: Record<string, unknown> | null;
  created_at: string;
}

type FeedbackLinkInsert = {
  company_id: string;
  candidate_id: string;
  job_id: string;
  application_id: string;
  created_by: string;
};

type FeedbackLinkDb = {
  from: (table: "feedback_links") => {
    insert: (values: FeedbackLinkInsert) => {
      select: (columns: "token") => {
        single: () => Promise<{ data: { token: string } | null; error: { message: string } | null }>;
      };
    };
  };
};

interface Props {
  app: Application;
  onClose: () => void;
  onStageChange: (stage: string) => void;
}

function formatAddress(candidate: CandidateDetails | null) {
  if (!candidate) return "";
  return [candidate.street_address, candidate.parish_state, candidate.country].filter(Boolean).join(", ");
}

export default function CandidatePanel({ app, onClose, onStageChange }: Props) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { flags } = useFeatureFlags();
  const [candidate, setCandidate] = useState<CandidateDetails | null>(null);
  const [applications, setApplications] = useState<ApplicationHistoryItem[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);

  const loadPanelData = async () => {
    setLoading(true);
    const [candidateResult, applicationsResult, notesResult, emailsResult] = await Promise.all([
      supabase
        .from("candidates")
        .select("id, company_id, name, email, phone, country, street_address, parish_state, education_level, linkedin_url, created_at")
        .eq("id", app.candidate_id)
        .maybeSingle(),
      supabase
        .from("applications")
        .select("id, stage, updated_at, created_at, job_id, jobs(title, status, hiring_manager)")
        .eq("candidate_id", app.candidate_id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("notes")
        .select("*")
        .eq("candidate_id", app.candidate_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("email_send_log")
        .select("id, template_key, context, created_at")
        .eq("candidate_id", app.candidate_id)
        .eq("status", "sent")
        .order("created_at", { ascending: false }),
    ]);

    if (candidateResult.error || !candidateResult.data) {
      toast.error("Failed to load candidate details");
      setLoading(false);
      return;
    }

    setCandidate(candidateResult.data as CandidateDetails);
    setApplications(
      ((applicationsResult.data ?? []) as unknown as ApplicationHistoryRow[]).map((item) => ({
        id: item.id,
        stage: item.stage,
        updated_at: item.updated_at,
        created_at: item.created_at,
        job_id: item.job_id,
        job_title: item.jobs?.title ?? "Untitled job",
        job_status: item.jobs?.status ?? null,
        hiring_manager: item.jobs?.hiring_manager ?? null,
      })),
    );
    setNotes((notesResult.data ?? []) as Note[]);
    setEmailLogs((emailsResult.data ?? []) as EmailLog[]);
    setLoading(false);
  };

  useEffect(() => {
    loadPanelData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.candidate_id]);

  const addNote = async () => {
    if (!profile || !newNote.trim()) return;
    const { error } = await supabase.from("notes").insert({
      company_id: profile.company_id,
      candidate_id: app.candidate_id,
      user_id: profile.user_id,
      content: newNote.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewNote("");
    await loadPanelData();
  };

  const generateFeedbackLink = async () => {
    if (!profile) return;
    setGeneratingLink(true);
    const feedbackDb = supabase as unknown as FeedbackLinkDb;
    const { data, error } = await feedbackDb
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

  const timelineEvents = useMemo(
    () =>
      buildPipelineCandidateTimeline({
        candidateId: app.candidate_id,
        candidateCreatedAt: candidate?.created_at,
        applications,
        notes,
        emailLogs,
      }),
    [app.candidate_id, applications, candidate?.created_at, emailLogs, notes],
  );

  const address = formatAddress(candidate);
  const activeApplication = applications.find((item) => item.id === app.id);
  const candidateName = candidate?.name ?? app.candidate?.name ?? "Candidate";
  const candidateEmail = candidate?.email ?? app.candidate?.email ?? null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex flex-col bg-card shadow-xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[min(760px,calc(100vw-2rem))] sm:border-l animate-slide-in-right">
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{candidateName}</h2>
                <p className="truncate text-sm text-muted-foreground">{app.job?.title}</p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-muted active:scale-95">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-5 p-5">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <>
                <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    {candidateEmail && (
                      <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{candidateEmail}</span>
                      </div>
                    )}
                    {candidate?.phone && (
                      <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        <span>{candidate.phone}</span>
                      </div>
                    )}
                    {address && (
                      <div className="flex min-w-0 items-center gap-2 text-muted-foreground sm:col-span-2">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{address}</span>
                      </div>
                    )}
                    {candidate?.education_level && (
                      <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                        <GraduationCap className="h-4 w-4 flex-shrink-0" />
                        <span>{candidate.education_level}</span>
                      </div>
                    )}
                    {candidate?.linkedin_url && (
                      <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                        <Linkedin className="h-4 w-4 flex-shrink-0" />
                        <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline">
                          LinkedIn Profile
                        </a>
                      </div>
                    )}
                  </div>
                  <CandidateTagsBar candidateId={app.candidate_id} />
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => setEmailComposerOpen(true)} disabled={!candidateEmail}>
                      <Send className="h-4 w-4" />
                      Email
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={() => onStageChange("rejected")}>
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => navigate(`/candidates/${app.candidate_id}`)}>
                      <ExternalLink className="h-4 w-4" />
                      Open full profile
                    </Button>
                  </div>
                </section>

                <section className="space-y-3 rounded-lg border bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Active application</h3>
                      <p className="text-xs text-muted-foreground">{activeApplication?.job_title ?? app.job?.title}</p>
                    </div>
                    <Badge className={STAGE_COLORS[app.stage] ?? ""} variant="secondary">
                      {STAGE_LABELS[app.stage] ?? app.stage}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Stage</label>
                    <Select value={app.stage} onValueChange={onStageChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map((stage) => (
                          <SelectItem key={stage} value={stage}>
                            {STAGE_LABELS[stage] ?? stage}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </section>

                <Tabs defaultValue="history" className="w-full">
                  <TabsList className="grid h-auto w-full grid-cols-3 sm:grid-cols-8">
                    <TabsTrigger value="history">History</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                    <TabsTrigger value="feedback">Feedback</TabsTrigger>
                    <TabsTrigger value="resumes">Resumes</TabsTrigger>
                    <TabsTrigger value="documents">Docs</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="screening">Screening</TabsTrigger>
                    <TabsTrigger value="forms">Forms</TabsTrigger>
                  </TabsList>

                  <TabsContent value="history" className="mt-4 space-y-2">
                    {applications.map((item) => (
                      <div key={item.id} className="rounded-lg border bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{item.job_title}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Applied {new Date(item.created_at).toLocaleDateString()}
                              </span>
                              <span>{item.job_status === "open" ? "Open job" : "Closed job"}</span>
                            </div>
                          </div>
                          <Badge className={STAGE_COLORS[item.stage] ?? ""} variant="secondary">
                            {(STAGE_LABELS[item.stage] ?? item.stage).replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="notes" className="mt-4 space-y-3">
                    <div className="flex gap-2">
                      <Textarea
                        value={newNote}
                        onChange={(event) => setNewNote(event.target.value)}
                        placeholder="Add a note..."
                        rows={2}
                        className="flex-1 text-sm"
                      />
                      <Button onClick={addNote} disabled={!newNote.trim()} size="sm" className="self-end">
                        Add
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {notes.map((note) => (
                        <div key={note.id} className="rounded-lg border bg-muted/20 p-3">
                          <div className="text-sm">{note.content}</div>
                          <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(note.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                      {notes.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No notes yet</p>}
                    </div>
                  </TabsContent>

                  <TabsContent value="feedback" className="mt-4">
                    {flags.guest_feedback && (
                      <div className="mb-3 flex justify-end">
                        <Button size="sm" variant="outline" onClick={generateFeedbackLink} disabled={generatingLink} className="gap-1.5">
                          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Link2 className="h-3.5 w-3.5" />}
                          {generatingLink ? "Generating..." : copied ? "Link copied" : "Generate feedback link"}
                        </Button>
                      </div>
                    )}
                    {profile && (
                      <InterviewFeedback
                        candidateId={app.candidate_id}
                        companyId={profile.company_id}
                        userId={profile.user_id}
                        jobs={[{ id: app.job_id, title: app.job.title, hiring_manager: app.job.hiring_manager }]}
                        defaultJobId={app.job_id}
                        currentUserName={profile.name}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="resumes" className="mt-4">
                    <ResumeHistory candidateId={app.candidate_id} />
                  </TabsContent>

                  <TabsContent value="documents" className="mt-4">
                    <CandidateDocuments candidateId={app.candidate_id} companyId={app.company_id} readOnly />
                  </TabsContent>

                  <TabsContent value="timeline" className="mt-4">
                    <ActivityTimeline events={timelineEvents} />
                  </TabsContent>
                  <TabsContent value="screening" className="mt-4"><ScreeningReview applicationId={app.id} /></TabsContent>
                  <TabsContent value="forms" className="mt-4">{candidate && profile && <CandidateForms candidateId={candidate.id} companyId={candidate.company_id} userId={profile.user_id} candidateEmail={candidate.email} />}</TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </div>
      </div>

      <CandidateEmailComposer
        open={emailComposerOpen}
        onOpenChange={setEmailComposerOpen}
        recipients={[
          {
            candidateId: app.candidate_id,
            applicationId: app.id,
            candidateName,
            candidateEmail,
            jobId: app.job_id,
            jobTitle: app.job.title,
          },
        ]}
      />

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
