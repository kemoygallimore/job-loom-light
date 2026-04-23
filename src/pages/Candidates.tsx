import { useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uploadResumeToR2 } from "@/lib/uploadResumeToR2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, User, X, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CandidateFilters from "@/components/candidate/CandidateFilters";
import CandidateQuickActions from "@/components/candidate/CandidateQuickActions";
import { fetchTagsForCandidates, getTagColorClasses, type CandidateTag } from "@/lib/candidateTags";

interface CandidateWithContext {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  resume_url: string | null;
  resume_bucket: string | null;
  resume_object_key: string | null;
  resume_filename: string | null;
  resume_content_type: string | null;
  resume_size_bytes: number | null;
  created_at: string;
  latest_app_id: string | null;
  latest_job_id: string | null;
  latest_job_title: string | null;
  latest_stage: string | null;
  latest_updated_at: string | null;
  application_count: number;
}

interface Job {
  id: string;
  title: string;
}

const STAGE_COLORS: Record<string, string> = {
  applied: "bg-muted text-muted-foreground",
  shortlisted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  screening: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  scheduling: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  "1st_interview": "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  "2nd_interview": "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400",
  interview: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  offer: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  hired: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function Candidates() {
  const { profile, role, loading: loadingAuth, refreshAuth } = useAuth();
  const notifiedMissingRoleRef = useRef(false);

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
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<CandidateWithContext[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tagsByCandidate, setTagsByCandidate] = useState<Map<string, CandidateTag[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editCandidate, setEditCandidate] = useState<CandidateWithContext | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");

  // Filters
  const [stageFilter, setStageFilter] = useState("all");
  const [jobFilter, setJobFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [repeatOnly, setRepeatOnly] = useState(false);

  const activeFilterCount = [
    stageFilter !== "all",
    jobFilter !== "all",
    !!dateFrom,
    !!dateTo,
    repeatOnly,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setStageFilter("all");
    setJobFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setRepeatOnly(false);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cRes, aRes, jRes] = await Promise.all([
        supabase.from("candidates").select("*").order("created_at", { ascending: false }),
        supabase.from("applications").select("id, candidate_id, stage, updated_at, created_at, job_id, jobs(title)").order("updated_at", { ascending: false }),
        supabase.from("jobs").select("id, title").order("title"),
      ]);

      if (cRes.error) throw cRes.error;
      if (aRes.error) throw aRes.error;

      setJobs((jRes.data ?? []) as Job[]);

      // Group applications per candidate
      const appsByCandidateId = new Map<string, any[]>();
      for (const app of aRes.data ?? []) {
        const list = appsByCandidateId.get(app.candidate_id) ?? [];
        list.push(app);
        appsByCandidateId.set(app.candidate_id, list);
      }

      const enriched: CandidateWithContext[] = (cRes.data ?? []).map((c) => {
        const apps = appsByCandidateId.get(c.id) ?? [];
        const latest = apps[0];
        return {
          ...c,
          latest_app_id: latest?.id ?? null,
          latest_job_id: latest?.job_id ?? null,
          latest_job_title: (latest as any)?.jobs?.title ?? null,
          latest_stage: latest?.stage ?? null,
          latest_updated_at: latest?.updated_at ?? null,
          application_count: apps.length,
        };
      });

      setCandidates(enriched);
      const tagMap = await fetchTagsForCandidates(enriched.map(c => c.id));
      setTagsByCandidate(tagMap);
    } catch (err: any) {
      setError(err.message ?? "Failed to load candidates");
      toast.error("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) load();
  }, [profile]);

  const filtered = useMemo(() => {
    let result = candidates;

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.email?.toLowerCase().includes(q) ?? false) ||
          (c.phone?.includes(q) ?? false) ||
          (c.latest_job_title?.toLowerCase().includes(q) ?? false)
      );
    }

    // Stage filter
    if (stageFilter !== "all") {
      result = result.filter((c) => c.latest_stage === stageFilter);
    }

    // Job filter
    if (jobFilter !== "all") {
      result = result.filter((c) => c.latest_job_id === jobFilter);
    }

    // Date from
    if (dateFrom) {
      const from = dateFrom.getTime();
      result = result.filter((c) => new Date(c.latest_updated_at ?? c.created_at).getTime() >= from);
    }

    // Date to
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((c) => new Date(c.latest_updated_at ?? c.created_at).getTime() <= to.getTime());
    }

    // Repeat applicants
    if (repeatOnly) {
      result = result.filter((c) => c.application_count > 1);
    }

    return result;
  }, [candidates, search, stageFilter, jobFilter, dateFrom, dateTo, repeatOnly]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    let resumeFields: {
      resume_url?: string | null;
      resume_bucket?: string | null;
      resume_object_key?: string | null;
      resume_filename?: string | null;
      resume_content_type?: string | null;
      resume_size_bytes?: number | null;
    } = {};

    if (resumeFile) {
      try {
        const candidateId = editCandidate?.id ?? email?.trim().toLowerCase() ?? crypto.randomUUID();
        const result = await uploadResumeToR2({
          file: resumeFile,
          companyId: profile.company_id!,
          candidateId,
        });
        resumeFields = {
          resume_url: result.key,
          resume_bucket: result.bucket,
          resume_object_key: result.key,
          resume_filename: result.filename,
          resume_content_type: result.contentType,
          resume_size_bytes: result.size,
        };
      } catch (err: any) {
        toast.error(err.message || "Resume upload failed");
        return;
      }
    }

    let savedCandidateId: string | null = null;

    if (editCandidate) {
      const { error } = await supabase.from("candidates").update({
        name,
        email: email || null,
        phone: phone || null,
        ...resumeFields,
      }).eq("id", editCandidate.id);
      if (error) { toast.error(error.message); return; }
      savedCandidateId = editCandidate.id;
      toast.success("Candidate updated");
    } else {
      const { data: inserted, error } = await supabase.from("candidates").insert({
        company_id: profile.company_id!,
        name,
        email: email || null,
        phone: phone || null,
        ...resumeFields,
      }).select("id").single();
      if (error) { toast.error(error.message); return; }
      savedCandidateId = inserted?.id ?? null;
      toast.success("Candidate added");
    }

    // Archive resume version into candidate_files history
    if (resumeFile && savedCandidateId && resumeFields.resume_object_key) {
      let archiveJobId = editCandidate?.latest_job_id ?? null;

      if (editCandidate && !archiveJobId) {
        const { data: latestApplication } = await supabase
          .from("applications")
          .select("job_id")
          .eq("candidate_id", savedCandidateId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        archiveJobId = latestApplication?.job_id ?? null;
      }

      const fileType =
        resumeFields.resume_content_type ||
        resumeFile.type ||
        "application/octet-stream";
      const { error: archiveError } = await supabase.from("candidate_files").insert({
        company_id: profile.company_id!,
        candidate_id: savedCandidateId,
        job_id: archiveJobId,
        category: "resume",
        bucket: resumeFields.resume_bucket!,
        file_key: resumeFields.resume_object_key!,
        file_name: resumeFields.resume_filename ?? resumeFile.name,
        file_type: fileType,
        file_size: resumeFields.resume_size_bytes ?? resumeFile.size,
      });
      if (archiveError) {
        console.error("candidate_files archive failed:", archiveError);
        toast.error(`Resume saved but history archive failed: ${archiveError.message}`);
      }
    }
    resetForm();
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("candidates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Candidate deleted");
    load();
  };

  const openEdit = (c: CandidateWithContext) => {
    setEditCandidate(c);
    setName(c.name);
    setEmail(c.email ?? "");
    setPhone(c.phone ?? "");
    setResumeFile(null);
    setOpen(true);
  };

  const resetForm = () => {
    setOpen(false);
    setEditCandidate(null);
    setName("");
    setEmail("");
    setPhone("");
    setResumeFile(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Candidates</h1>
          {!loading && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {filtered.length} candidate{filtered.length !== 1 ? "s" : ""}
              {activeFilterCount > 0 ? " (filtered)" : ""}
            </p>
          )}
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Candidate</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editCandidate ? "Edit Candidate" : "New Candidate"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Resume</Label><Input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)} /></div>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md animate-fade-in" style={{ animationDelay: "60ms" }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, phone, or job title..." className="pl-9 pr-9" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <CandidateFilters
        stageFilter={stageFilter}
        jobFilter={jobFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        repeatOnly={repeatOnly}
        jobs={jobs}
        onStageChange={setStageFilter}
        onJobChange={setJobFilter}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onRepeatOnlyChange={setRepeatOnly}
        onClearAll={clearFilters}
        activeCount={activeFilterCount}
      />

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive animate-fade-in">
          {error}
          <Button variant="ghost" size="sm" className="ml-2" onClick={load}>Retry</Button>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden animate-fade-in" style={{ animationDelay: "160ms", boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold hidden sm:table-cell">Email</TableHead>
              <TableHead className="font-semibold hidden md:table-cell">Phone</TableHead>
              <TableHead className="font-semibold hidden lg:table-cell">Job Applied</TableHead>
              <TableHead className="font-semibold hidden sm:table-cell">Stage</TableHead>
              <TableHead className="font-semibold">Updated</TableHead>
              <TableHead className="font-semibold w-36">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-28" /></TableCell>
                  <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-36" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <User className="w-8 h-8 text-muted-foreground/40" />
                    <span>{search || activeFilterCount > 0 ? "No matching applicants found" : "No candidates yet. Add your first candidate."}</span>
                    {activeFilterCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">Clear filters</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className="group cursor-pointer" onClick={() => navigate(`/candidates/${c.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium">{c.name}</span>
                        {c.application_count > 1 && (
                          <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0 gap-0.5 border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400">
                            <RotateCcw className="w-2.5 h-2.5" />{c.application_count}
                          </Badge>
                        )}
                        {(tagsByCandidate.get(c.id) ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(tagsByCandidate.get(c.id) ?? []).map(t => (
                              <span
                                key={t.id}
                                className={`inline-flex items-center rounded-full border text-[10px] px-1.5 py-0 font-medium ${getTagColorClasses(t.color)}`}
                              >
                                {t.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm hidden md:table-cell">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-sm hidden lg:table-cell">{c.latest_job_title ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {c.latest_stage ? (
                      <Badge variant="secondary" className={`capitalize text-xs font-medium ${STAGE_COLORS[c.latest_stage] ?? ""}`}>
                        {c.latest_stage.replace(/_/g, " ")}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {new Date(c.latest_updated_at ?? c.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <CandidateQuickActions
                        candidateId={c.id}
                        companyId={c.company_id}
                        userId={profile!.user_id}
                        latestAppId={c.latest_app_id}
                        latestStage={c.latest_stage}
                        resumeUrl={c.resume_url}
                        resumeBucket={c.resume_bucket}
                        resumeObjectKey={c.resume_object_key}
                        onStageChanged={load}
                        onNoteAdded={load}
                        hideStageChange
                      />
                      <div className="flex items-center gap-0.5 border-l border-border ml-1 pl-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {loadingAuth ? null : !role ? null : role === "admin" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this candidate?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove <span className="font-medium text-foreground">{c.name}</span> along with their applications, notes, feedback, tags, and uploaded files. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDelete(c.id)}
                                >
                                  Delete candidate
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
