import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Copy, Check, Video, Eye, Pencil, Trash2 } from "lucide-react";
import { format, addDays, isAfter } from "date-fns";
import { Link } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteScreeningVideosFromR2 } from "@/lib/deleteScreeningVideoFromR2";

interface ScreeningJob {
  id: string;
  company_id: string;
  created_by: string;
  title: string;
  question: string;
  expires_at: string;
  unique_link_id: string;
  created_at: string;
  submission_count?: number;
}

export default function ScreeningJobs() {
  const { profile, user, role } = useAuth();
  const [jobs, setJobs] = useState<ScreeningJob[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(addDays(new Date(), 7));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editJob, setEditJob] = useState<ScreeningJob | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editQuestion, setEditQuestion] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState<Date | undefined>(undefined);
  const [savingEdit, setSavingEdit] = useState(false);
  const [view, setView] = useState<"active" | "all">("active");
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: jobsData } = await supabase
      .from("screening_jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (jobsData) {
      // Fetch submission counts
      const { data: counts } = await supabase
        .from("screening_submissions")
        .select("screening_job_id");

      const countMap: Record<string, number> = {};
      counts?.forEach((s: any) => {
        countMap[s.screening_job_id] = (countMap[s.screening_job_id] || 0) + 1;
      });

      setJobs(jobsData.map((j: any) => ({
        ...j,
        submission_count: countMap[j.id] || 0,
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (profile) load();
  }, [profile]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !user || !expiresAt) return;

    // Validate max 30 days
    if (isAfter(expiresAt, addDays(new Date(), 30))) {
      toast.error("Expiration date cannot exceed 30 days from today");
      return;
    }

    // First create the regular job
    const { data: newJob, error: jobError } = await supabase.from("jobs").insert({
      company_id: profile.company_id,
      title,
      status: "open" as any,
    }).select().single();

    if (jobError) {
      toast.error(jobError.message);
      return;
    }

    // Then create the screening job linked to it
    const { error } = await supabase.from("screening_jobs").insert({
      company_id: profile.company_id,
      created_by: user.id,
      title,
      question,
      expires_at: expiresAt.toISOString(),
      job_id: newJob.id,
    });

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Screening job created");
    setOpen(false);
    setTitle("");
    setQuestion("");
    setExpiresAt(addDays(new Date(), 7));
    load();
  };

  const copyLink = async (linkId: string) => {
    const url = `${window.location.origin}/screen/${linkId}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(linkId);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isExpired = (date: string) => !isAfter(new Date(date), new Date());

  const visibleJobs = view === "active" ? jobs.filter((j) => !isExpired(j.expires_at)) : jobs;

  const openEdit = (job: ScreeningJob) => {
    setEditJob(job);
    setEditTitle(job.title);
    setEditQuestion(job.question);
    setEditExpiresAt(new Date(job.expires_at));
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editJob || !editExpiresAt) return;
    if (isAfter(editExpiresAt, addDays(new Date(), 30))) {
      toast.error("Expiration date cannot exceed 30 days from today");
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase
      .from("screening_jobs")
      .update({
        title: editTitle,
        question: editQuestion,
        expires_at: editExpiresAt.toISOString(),
      })
      .eq("id", editJob.id);
    setSavingEdit(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Screening job updated");
    setEditJob(null);
    load();
  };

  const handleDeleteJob = async (job: ScreeningJob) => {
    setDeletingJobId(job.id);
    try {
      // 1. Gather all submissions for this job (to delete videos from R2)
      const { data: subs, error: fetchErr } = await supabase
        .from("screening_submissions")
        .select("video_bucket, video_object_key, video_url")
        .eq("screening_job_id", job.id);
      if (fetchErr) throw new Error(fetchErr.message);

      // 2. Best-effort R2 cleanup
      let r2Warning: string | null = null;
      try {
        const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
        await deleteScreeningVideosFromR2(
          (subs ?? []).map((s: any) => ({
            bucket: s.video_bucket,
            key: s.video_object_key ?? s.video_url ?? "",
          })),
          accessToken,
        );
      } catch (err: any) {
        r2Warning = err?.message || "Failed to delete some video files from storage";
      }

      // 3. Delete submission rows
      const { error: subDelErr } = await supabase
        .from("screening_submissions")
        .delete()
        .eq("screening_job_id", job.id);
      if (subDelErr) throw new Error(subDelErr.message);

      // 4. Delete the screening job itself
      const { error: jobDelErr } = await supabase
        .from("screening_jobs")
        .delete()
        .eq("id", job.id);
      if (jobDelErr) throw new Error(jobDelErr.message);

      if (r2Warning) {
        toast.warning(`Screening job removed, but storage cleanup failed: ${r2Warning}`);
      } else {
        toast.success("Screening job and all submissions deleted");
      }
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete screening job");
    } finally {
      setDeletingJobId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-6 h-6 text-primary" />
            Video Screening
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Create screening jobs and review candidate videos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />New Screening Job</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Screening Job</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Job Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Frontend Developer" required />
              </div>
              <div className="space-y-1.5">
                <Label>Screening Question</Label>
                <Textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="e.g. Tell us about your experience with React and TypeScript"
                  rows={3}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Expiration Date (max 30 days)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !expiresAt && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expiresAt ? format(expiresAt, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expiresAt}
                      onSelect={setExpiresAt}
                      disabled={(date) => date < new Date() || date > addDays(new Date(), 30)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Button type="submit" className="w-full">Create Screening Job</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as "active" | "all")} className="animate-fade-in">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="bg-card rounded-xl border overflow-hidden animate-fade-in" style={{ animationDelay: "80ms", boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold">Job Title</TableHead>
              <TableHead className="font-semibold">Question</TableHead>
              <TableHead className="font-semibold">Submissions</TableHead>
              <TableHead className="font-semibold">Expires</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleJobs.map(job => (
              <TableRow key={job.id} className="group">
                <TableCell className="font-medium">{job.title}</TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{job.question.slice(0, 50)}{job.question.length > 50 ? '…' : ''}</TableCell>
                <TableCell>
                  <span className="font-semibold tabular-nums">{job.submission_count}</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {format(new Date(job.expires_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <span className={`badge-stage ${isExpired(job.expires_at) ? "badge-rejected" : "badge-hired"}`}>
                    {isExpired(job.expires_at) ? "Expired" : "Active"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyLink(job.unique_link_id)} title="Copy screening link">
                      {copiedId === job.unique_link_id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(job)} title="Edit screening question">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Link to={`/screening/${job.id}/submissions`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="View submissions">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                    {role === "admin" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={deletingJobId === job.id}
                            title="Delete screening job"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this screening job?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove{" "}
                              <span className="font-medium text-foreground">{job.title}</span>,{" "}
                              all {job.submission_count ?? 0} video submission
                              {(job.submission_count ?? 0) === 1 ? "" : "s"}, their ratings, notes,
                              and the video files from storage. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDeleteJob(job)}
                            >
                              Delete job
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && visibleJobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  {view === "active" && jobs.length > 0
                    ? "No active screening jobs. Switch to All to see expired jobs."
                    : "No screening jobs yet. Create your first one to get started."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Screening Job Dialog */}
      <Dialog open={!!editJob} onOpenChange={(o) => !o && setEditJob(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Screening Job</DialogTitle></DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Job Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Screening Question</Label>
              <Textarea
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
                rows={4}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expiration Date (max 30 days from today)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className={cn("w-full justify-start text-left font-normal", !editExpiresAt && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editExpiresAt ? format(editExpiresAt, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editExpiresAt}
                    onSelect={setEditExpiresAt}
                    disabled={(date) => date < new Date() || date > addDays(new Date(), 30)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button type="submit" className="w-full" disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
