import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getSignedVideoViewUrl } from "@/lib/getSignedVideoViewUrl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Play, Star, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Submission {
  id: string;
  candidate_name: string;
  candidate_email: string;
  video_url: string | null;
  video_bucket: string | null;
  video_object_key: string | null;
  rating: number | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface ScreeningJob {
  id: string;
  title: string;
  question: string;
  expires_at: string;
}

export default function ScreeningSubmissions() {
  const { jobId } = useParams<{ jobId: string }>();
  const { profile, role, loading: loadingAuth, refreshAuth } = useAuth();
  const notifiedMissingRoleRef = useRef(false);
  const [job, setJob] = useState<ScreeningJob | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (loadingAuth) return;
    if (profile && !role && !notifiedMissingRoleRef.current) {
      notifiedMissingRoleRef.current = true;
      toast.error("Couldn't load your role. Retrying…");
      refreshAuth();
    }
    if (role) {
      notifiedMissingRoleRef.current = false;
    }
  }, [loadingAuth, profile, role, refreshAuth]);

  const load = async () => {
    if (!jobId) return;
    const { data: jobData } = await supabase
      .from("screening_jobs")
      .select("id, title, question, expires_at")
      .eq("id", jobId)
      .maybeSingle();
    setJob(jobData as ScreeningJob | null);

    const { data: subs } = await supabase
      .from("screening_submissions")
      .select("id, candidate_name, candidate_email, video_url, video_bucket, video_object_key, rating, notes, status, created_at")
      .eq("screening_job_id", jobId)
      .order("created_at", { ascending: false });
    setSubmissions((subs as Submission[]) ?? []);
  };

  useEffect(() => {
    if (profile) load();
  }, [profile, jobId]);

  const openReview = async (sub: Submission) => {
    setSelectedSub(sub);
    setRating(sub.rating ?? 0);
    setNotes(sub.notes ?? "");
    setResolvedVideoUrl(null);
    setLoadingVideo(true);
    setReviewOpen(true);

    try {
      // Use video_object_key if available, fall back to video_url (legacy rows)
      const key = sub.video_object_key ?? sub.video_url;
      const bucket = sub.video_bucket; // helper defaults to "silverweb-ats-videos" if null
      const url = await getSignedVideoViewUrl(bucket, key);
      setResolvedVideoUrl(url);
    } catch (err: any) {
      toast.error("Failed to load video: " + (err.message || "Unknown error"));
    } finally {
      setLoadingVideo(false);
    }

    // Mark as watched
    if (sub.status === "new") {
      await supabase.from("screening_submissions").update({ status: "watched" }).eq("id", sub.id);
      setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: "watched" } : s));
    }
  };

  const saveReview = async () => {
    if (!selectedSub) return;
    const { error } = await supabase
      .from("screening_submissions")
      .update({ rating: rating || null, notes: notes || null })
      .eq("id", selectedSub.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Review saved");
    setReviewOpen(false);
    load();
  };

  const handleDelete = async (sub: Submission) => {
    setDeletingId(sub.id);
    const { error } = await supabase
      .from("screening_submissions")
      .delete()
      .eq("id", sub.id);
    setDeletingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Screening video deleted");
    setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <Link to="/screening" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Screening Jobs
        </Link>
        <h1 className="text-2xl font-bold">{job?.title ?? "Submissions"}</h1>
        {job && <p className="text-sm text-muted-foreground mt-1">Question: {job.question}</p>}
      </div>

      <div className="bg-card rounded-xl border overflow-hidden animate-fade-in" style={{ animationDelay: "80ms", boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold">Candidate</TableHead>
              <TableHead className="font-semibold">Email</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Rating</TableHead>
              <TableHead className="font-semibold">Submitted</TableHead>
              <TableHead className="font-semibold w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.map(sub => (
              <TableRow key={sub.id} className="group">
                <TableCell className="font-medium">{sub.candidate_name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{sub.candidate_email}</TableCell>
                <TableCell>
                  <span className={`badge-stage ${sub.status === "new" ? "badge-applied" : "badge-screening"}`}>
                    {sub.status === "new" ? "New" : "Watched"}
                  </span>
                </TableCell>
                <TableCell>
                  {sub.rating ? (
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < sub.rating! ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {format(new Date(sub.created_at), "MMM d, yyyy h:mm a")}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openReview(sub)} className="gap-1.5">
                      <Play className="w-3.5 h-3.5" /> Review
                    </Button>
                    {!loadingAuth && role === "admin" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={
                              deletingId === sub.id ||
                              (reviewOpen && selectedSub?.id === sub.id)
                            }
                            title={
                              reviewOpen && selectedSub?.id === sub.id
                                ? "Close the review to delete this video"
                                : "Delete submission"
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this screening video?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove the submission from{" "}
                              <span className="font-medium text-foreground">{sub.candidate_name}</span>,
                              including their video, rating, and notes. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDelete(sub)}
                            >
                              Delete video
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {submissions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No submissions yet for this screening job.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedSub?.candidate_name}</DialogTitle>
          </DialogHeader>
          {selectedSub && (
            <div className="space-y-4">
              {loadingVideo ? (
                <div className="w-full rounded-lg bg-black aspect-video flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : resolvedVideoUrl ? (
                <video
                  src={resolvedVideoUrl}
                  controls
                  className="w-full rounded-lg bg-black aspect-video"
                />
              ) : (
                <div className="w-full rounded-lg bg-black aspect-video flex items-center justify-center text-muted-foreground text-sm">
                  Failed to load video
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Rating</label>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setRating(i + 1)}
                        className="p-0.5 hover:scale-110 transition-transform"
                      >
                        <Star className={`w-6 h-6 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30 hover:text-yellow-300"}`} />
                      </button>
                    ))}
                    {rating > 0 && (
                      <button onClick={() => setRating(0)} className="ml-2 text-xs text-muted-foreground hover:text-foreground">
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Notes</label>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add your notes about this candidate..."
                    rows={3}
                  />
                </div>
                <Button onClick={saveReview} className="w-full">Save Review</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
