import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Trash2, Search, User, X, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CandidateFilters from "@/components/candidate/CandidateFilters";
import CandidateQuickActions from "@/components/candidate/CandidateQuickActions";
import { fetchTagsForCandidates, getTagColorClasses, type CandidateTag } from "@/lib/candidateTags";
import { keys, type CandidateFilters as CandidateQueryFilters } from "@/lib/queryKeys";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StageBadge from "@/components/shared/StageBadge";
import PageHeader from "@/components/shared/PageHeader";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

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
  parish_state: string | null;
  country: string | null;
  latest_app_id: string | null;
  latest_job_id: string | null;
  latest_job_title: string | null;
  latest_job_status: string | null;
  latest_stage: string | null;
  latest_updated_at: string | null;
  application_count: number;
}

interface Job {
  id: string;
  title: string;
}

interface ApplicationRow {
  id: string;
  candidate_id: string;
  stage: string | null;
  updated_at: string | null;
  created_at: string;
  job_id: string | null;
  jobs: { title: string | null; status: string | null } | null;
}

interface CandidatesQueryData {
  candidates: CandidateWithContext[];
  jobs: Job[];
  tagsByCandidate: Map<string, CandidateTag[]>;
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

async function fetchCandidatesData(): Promise<CandidatesQueryData> {
  const [cRes, aRes, jRes] = await Promise.all([
    supabase.from("candidates").select("*").order("created_at", { ascending: false }),
    supabase
      .from("applications")
      .select("id, candidate_id, stage, updated_at, created_at, job_id, jobs(title, status)")
      .order("updated_at", { ascending: false }),
    supabase.from("jobs").select("id, title").order("title"),
  ]);

  if (cRes.error) throw cRes.error;
  if (aRes.error) throw aRes.error;

  const appsByCandidateId = new Map<string, ApplicationRow[]>();
  for (const app of (aRes.data ?? []) as unknown as ApplicationRow[]) {
    const list = appsByCandidateId.get(app.candidate_id) ?? [];
    list.push(app);
    appsByCandidateId.set(app.candidate_id, list);
  }

  const candidates: CandidateWithContext[] = (cRes.data ?? []).map((c) => {
    const apps = appsByCandidateId.get(c.id) ?? [];
    const latest = apps[0];
    return {
      ...c,
      latest_app_id: latest?.id ?? null,
      latest_job_id: latest?.job_id ?? null,
      latest_job_title: latest?.jobs?.title ?? null,
      latest_job_status: latest?.jobs?.status ?? null,
      latest_stage: latest?.stage ?? null,
      latest_updated_at: latest?.updated_at ?? null,
      application_count: apps.length,
    };
  });

  const tagsByCandidate = await fetchTagsForCandidates(candidates.map((candidate) => candidate.id));

  return {
    candidates,
    jobs: (jRes.data ?? []) as Job[],
    tagsByCandidate,
  };
}

export default function Candidates() {
  const { profile, role, loading: loadingAuth, refreshAuth } = useAuth();
  const queryClient = useQueryClient();
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
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"active" | "all">("active");

  // Filters
  const [stageFilter, setStageFilter] = useState("all");
  const [jobFilter, setJobFilter] = useState("all");
  const [parishFilter, setParishFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [repeatOnly, setRepeatOnly] = useState(false);

  const activeFilterCount = [
    stageFilter !== "all",
    jobFilter !== "all",
    parishFilter !== "all",
    !!dateFrom,
    !!dateTo,
    repeatOnly,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setStageFilter("all");
    setJobFilter("all");
    setParishFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setRepeatOnly(false);
  };

  const candidateListFilters = useMemo<CandidateQueryFilters>(
    () => ({
      jobFilter: "all",
      parishFilter: "all",
      repeatOnly: false,
      search: "",
      stageFilter: "all",
    }),
    [],
  );

  const candidatesQuery = useQuery({
    queryKey: keys.candidates("all", candidateListFilters),
    queryFn: fetchCandidatesData,
    enabled: Boolean(profile),
  });

  useEffect(() => {
    if (candidatesQuery.error) toast.error("Failed to load candidates");
  }, [candidatesQuery.error]);

  const candidates = candidatesQuery.data?.candidates ?? [];
  const jobs = candidatesQuery.data?.jobs ?? [];
  const tagsByCandidate = candidatesQuery.data?.tagsByCandidate ?? new Map<string, CandidateTag[]>();
  const loading = candidatesQuery.isLoading;
  const error = candidatesQuery.error ? errorMessage(candidatesQuery.error, "Failed to load candidates") : null;

  const refreshCandidates = () => {
    queryClient.invalidateQueries({ queryKey: [...keys.all, "candidates"] });
  };

  const filtered = useMemo(() => {
    let result = candidates;

    if (view === "active") {
      result = result.filter((c) => c.latest_job_status === "open");
    }

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

    // Parish/state filter
    if (parishFilter !== "all") {
      result = result.filter((c) => (c.parish_state ?? "") === parishFilter);
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
  }, [candidates, search, stageFilter, jobFilter, parishFilter, dateFrom, dateTo, repeatOnly, view]);

  const parishOptions = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => {
      const p = c.parish_state?.trim();
      if (p) set.add(p);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [candidates]);

  const deleteCandidateMutation = useMutation({
    mutationFn: async (candidate: CandidateWithContext) => {
      const { data, error } = await supabase.functions.invoke<{ error?: string }>("delete-candidate-privacy", {
        body: { candidate_id: candidate.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return candidate.id;
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to delete candidate"));
    },
    onSuccess: (id) => {
      toast.success("Candidate permanently deleted");
      queryClient.invalidateQueries({ queryKey: [...keys.all, "candidates"] });
      queryClient.invalidateQueries({ queryKey: [...keys.all, "tags"] });
      queryClient.invalidateQueries({ queryKey: keys.candidate(id) });
      queryClient.invalidateQueries({ queryKey: [...keys.all, "pipeline"] });
    },
  });

  const handleDelete = (candidate: CandidateWithContext) => {
    deleteCandidateMutation.mutate(candidate);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title="Candidates"
        description={
          !loading ? (
            <p>
              {filtered.length} candidate{filtered.length !== 1 ? "s" : ""}
              {activeFilterCount > 0 ? " (filtered)" : ""}
            </p>
          ) : undefined
        }
      />

      {/* View toggle */}
      <Tabs value={view} onValueChange={(v) => setView(v as "active" | "all")} className="animate-fade-in">
        <TabsList>
          <TabsTrigger value="active">Active Jobs</TabsTrigger>
          <TabsTrigger value="all">All Candidates</TabsTrigger>
        </TabsList>
      </Tabs>

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
        parishFilter={parishFilter}
        parishOptions={parishOptions}
        dateFrom={dateFrom}
        dateTo={dateTo}
        repeatOnly={repeatOnly}
        jobs={jobs}
        onStageChange={setStageFilter}
        onJobChange={setJobFilter}
        onParishChange={setParishFilter}
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
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => candidatesQuery.refetch()}>Retry</Button>
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
                    <span>{search || activeFilterCount > 0 ? "No matching applicants found" : "No candidates yet. Share your public job link to start receiving applications."}</span>
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
                      <StageBadge stage={c.latest_stage} />
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
                        onStageChanged={refreshCandidates}
                        onNoteAdded={refreshCandidates}
                        hideStageChange
                      />
                      <div className="flex items-center gap-0.5 border-l border-border ml-1 pl-1" onClick={(e) => e.stopPropagation()}>
                        {loadingAuth ? null : !role ? null : role === "admin" && (
                          <ConfirmDialog
                            title="Delete this candidate?"
                            description={
                              <>
                                This will permanently remove <span className="font-medium text-foreground">{c.name}</span> along with their applications, consent records, email logs, notes, feedback, tags, screening submissions, and uploaded files. This action cannot be undone.
                              </>
                            }
                            confirmLabel="Permanently delete"
                            destructive
                            onConfirm={() => handleDelete(c)}
                            trigger={
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            }
                          />
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
