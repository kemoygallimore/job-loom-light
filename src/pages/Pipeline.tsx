import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ChevronDown, FileText, Mail, Plus, Video, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportRequestDialog } from "@/components/export/ExportRequestDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Search, SlidersHorizontal } from "lucide-react";

import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import KanbanCard from "@/components/pipeline/KanbanCard";
import CandidatePanel from "@/components/pipeline/CandidatePanel";
import { CandidateEmailComposer, type CandidateEmailRecipient } from "@/components/email/CandidateEmailComposer";
import type { CandidateEmailTemplatePurpose } from "@/lib/candidateEmailTemplates";
import { CandidateFormSendDialog, type CandidateFormRecipient } from "@/components/candidate/CandidateFormSendDialog";
import {
  reconcilePipelineSelection,
  type PipelineApplication,
  type PipelineStage,
} from "@/lib/pipeline";
import { keys, type PipelineFilters } from "@/lib/queryKeys";
import { PIPELINE_STAGES, STAGE_LABELS } from "@/lib/stages";
import PageHeader from "@/components/shared/PageHeader";

type Stage = PipelineStage;

export type Application = PipelineApplication;

type PipelineRow = {
  id: string;
  job_id: string;
  candidate_id: string;
  stage: string;
  company_id: string;
  candidate_name: string;
  candidate_email: string | null;
  job_title: string;
  hiring_manager: string | null;
  screening_score: number | null;
  screening_status: string | null;
  review_needed_count: number | null;
  interview_average: number | null;
};

async function fetchPipeline(jobId: string, filters: PipelineFilters): Promise<Application[]> {
  const { data, error } = await supabase.rpc("get_job_pipeline", {
    _job_id: jobId,
    _search: filters.search.trim() || null,
    _screening_min: filters.screeningMin ? Number(filters.screeningMin) : null,
    _screening_max: filters.screeningMax ? Number(filters.screeningMax) : null,
    _screening_status: filters.screeningStatus === "all" ? null : filters.screeningStatus,
    _sort: filters.sort,
  });
  if (error) throw error;
  return ((data ?? []) as PipelineRow[]).map((row) => ({
    id: row.id,
    job_id: row.job_id,
    candidate_id: row.candidate_id,
    stage: row.stage as Stage,
    company_id: row.company_id,
    candidate: { name: row.candidate_name, email: row.candidate_email },
    job: { title: row.job_title, hiring_manager: row.hiring_manager, status: "open" },
    screening_score: row.screening_score,
    screening_status: row.screening_status,
    review_needed_count: row.review_needed_count ?? 0,
    interview_average: row.interview_average,
  }));
}

async function fetchOpenJobs() {
  const { data, error } = await supabase.from("jobs").select("id, title").eq("status", "open");
  if (error) throw error;
  return (data ?? []) as { id: string; title: string }[];
}

async function fetchCandidateOptions() {
  const { data, error } = await supabase.from("candidates").select("id, name");
  if (error) throw error;
  return (data ?? []) as { id: string; name: string }[];
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

export default function Pipeline() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedJobFilter, setSelectedJobFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("screening_desc");
  const [screeningStatus, setScreeningStatus] = useState("all");
  const [screeningMin, setScreeningMin] = useState("");
  const [screeningMax, setScreeningMax] = useState("");
  const filterStorageKey = profile?.user_id && selectedJobFilter ? `pipeline:${profile.user_id}:${selectedJobFilter}` : null;
  const [loadedFilterKey, setLoadedFilterKey] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newJobId, setNewJobId] = useState("");
  const [newCandidateId, setNewCandidateId] = useState("");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionPurpose, setActionPurpose] = useState<Exclude<CandidateEmailTemplatePurpose, "form_link">>("general");
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectDialogIds, setRejectDialogIds] = useState<string[]>([]);
  
  const pipelineFilters = useMemo<PipelineFilters>(
    () => ({ search, screeningMax, screeningMin, screeningStatus, sort }),
    [search, screeningMax, screeningMin, screeningStatus, sort],
  );
  const pipelineKey = keys.pipeline(selectedJobFilter, pipelineFilters);

  const jobsQuery = useQuery({
    queryKey: keys.jobsOpen(),
    queryFn: fetchOpenJobs,
    enabled: Boolean(profile),
  });
  const candidateOptionsQuery = useQuery({
    queryKey: keys.candidateOptions(),
    queryFn: fetchCandidateOptions,
    enabled: Boolean(profile),
  });
  const pipelineQuery = useQuery({
    queryKey: pipelineKey,
    queryFn: () => fetchPipeline(selectedJobFilter, pipelineFilters),
    enabled: Boolean(profile && selectedJobFilter && filterStorageKey && loadedFilterKey === filterStorageKey),
  });

  useEffect(() => {
    const openJobs = jobsQuery.data ?? [];
    setSelectedJobFilter((current) => openJobs.some((job) => job.id === current) ? current : (openJobs[0]?.id ?? ""));
  }, [jobsQuery.data]);

  useEffect(() => {
    if (pipelineQuery.error) toast.error(errorMessage(pipelineQuery.error, "Failed to load pipeline"));
  }, [pipelineQuery.error]);

  useEffect(() => {
    if (jobsQuery.error || candidateOptionsQuery.error) toast.error("Failed to load options");
  }, [candidateOptionsQuery.error, jobsQuery.error]);

  const applications = useMemo(() => pipelineQuery.data ?? [], [pipelineQuery.data]);
  const jobs = jobsQuery.data ?? [];
  const candidates = candidateOptionsQuery.data ?? [];

  useEffect(() => {
    setSelectedIds((current) => reconcilePipelineSelection(applications, current, null).selectedIds);
    setRejectDialogIds((current) => reconcilePipelineSelection(applications, current, null).selectedIds);
    setSelectedApp((current) => reconcilePipelineSelection(applications, [], current).selectedApp);
  }, [applications]);

  useEffect(() => {
    if (!filterStorageKey) return;
    const saved = window.localStorage.getItem(filterStorageKey);
    if (!saved) { setLoadedFilterKey(filterStorageKey); return; }
    try {
      const state = JSON.parse(saved) as { search?: string; sort?: string; screeningStatus?: string; screeningMin?: string; screeningMax?: string };
      setSearch(state.search ?? ""); setSort(state.sort ?? "screening_desc"); setScreeningStatus(state.screeningStatus ?? "all"); setScreeningMin(state.screeningMin ?? ""); setScreeningMax(state.screeningMax ?? "");
    } catch { window.localStorage.removeItem(filterStorageKey); }
    setLoadedFilterKey(filterStorageKey);
  }, [filterStorageKey]);

  useEffect(() => {
    if (!filterStorageKey || loadedFilterKey !== filterStorageKey) return;
    window.localStorage.setItem(filterStorageKey, JSON.stringify({ search, sort, screeningStatus, screeningMin, screeningMax }));
  }, [filterStorageKey, loadedFilterKey, search, screeningMax, screeningMin, screeningStatus, sort]);

  const moveStageMutation = useMutation({
    mutationFn: async ({ appId, newStage }: { appId: string; newStage: Stage }) => {
      const { error } = await supabase.from("applications").update({ stage: newStage }).eq("id", appId);
      if (error) throw error;
    },
    onMutate: async ({ appId, newStage }) => {
      await queryClient.cancelQueries({ queryKey: pipelineKey });
      const previous = queryClient.getQueryData<Application[]>(pipelineKey);
      queryClient.setQueryData<Application[]>(pipelineKey, (current = []) =>
        current.map((app) => (app.id === appId ? { ...app, stage: newStage } : app)),
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(pipelineKey, context.previous);
      toast.error(errorMessage(error, "Failed"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pipelineKey });
    },
  });

  const createApplicationMutation = useMutation({
    mutationFn: async () => {
      if (!profile) return;
      const { error } = await supabase.from("applications").insert({
        company_id: profile.company_id,
        job_id: newJobId,
        candidate_id: newCandidateId,
        stage: "applied" as Stage,
      });
      if (error) throw error;
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed"));
    },
    onSuccess: () => {
      toast.success("Application created");
      setCreateOpen(false);
      setNewJobId("");
      setNewCandidateId("");
      queryClient.invalidateQueries({ queryKey: [...keys.all, "pipeline"] });
      queryClient.invalidateQueries({ queryKey: keys.candidateOptions() });
      queryClient.invalidateQueries({ queryKey: [...keys.all, "candidates"] });
      queryClient.invalidateQueries({ queryKey: keys.candidate(newCandidateId) });
    },
  });

  const onDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    const newStage = destination.droppableId as Stage;
    const app = applications.find(a => a.id === draggableId);
    if (!app || app.stage === newStage) return;

    if (newStage === "rejected") {
      openRejectDialog([draggableId]);
      return;
    }

    moveStageMutation.mutate({ appId: draggableId, newStage });
  };

  const createApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    createApplicationMutation.mutate();
  };

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter(x => x !== id);
    });
  };

  const toggleStageSelection = (stageApps: Application[]) => {
    const ids = stageApps.map((app) => app.id);
    if (ids.length === 0) return;
    const allSelected = ids.every((id) => selectedIds.includes(id));

    setSelectedIds((current) => {
      if (allSelected) return current.filter((id) => !ids.includes(id));
      return Array.from(new Set([...current, ...ids]));
    });
  };

  const openActionDialog = (purpose: Exclude<CandidateEmailTemplatePurpose, "form_link">) => {
    if (selectedIds.length === 0) return;
    setActionPurpose(purpose);
    setActionDialogOpen(true);
  };

  const openFormDialog = () => {
    if (selectedIds.length === 0) return;
    setFormDialogOpen(true);
  };

  const openRejectDialog = (ids: string[]) => {
    if (!profile) return;
    if (ids.length === 0) return;
    setRejectDialogIds(Array.from(new Set(ids)));
    setRejectDialogOpen(true);
  };

  const handleRejectDialogOpenChange = (open: boolean) => {
    setRejectDialogOpen(open);
    if (!open) setRejectDialogIds([]);
  };

  const handleRejectSent = (ids: string[]) => {
    const targetIdSet = new Set(ids);
    queryClient.setQueryData<Application[]>(pipelineKey, (current = []) =>
      current.map((app) => (targetIdSet.has(app.id) ? { ...app, stage: "rejected" as Stage } : app)),
    );
    setSelectedIds(prev => prev.filter(id => !targetIdSet.has(id)));
    if (selectedApp && targetIdSet.has(selectedApp.id)) {
      setSelectedApp({ ...selectedApp, stage: "rejected" as Stage });
    }
    queryClient.invalidateQueries({ queryKey: pipelineKey });
  };



  const filtered = applications;
  const exportFilters = useMemo(
    () => ({
      jobId: selectedJobFilter,
      search,
      sort,
      screeningStatus,
      screeningMin,
      screeningMax,
    }),
    [screeningMax, screeningMin, screeningStatus, search, selectedJobFilter, sort],
  );
  const rejectDialogApps = applications.filter((app) => rejectDialogIds.includes(app.id));
  const selectedApps = applications.filter((app) => selectedIds.includes(app.id));

  const toEmailRecipients = (apps: Application[]): CandidateEmailRecipient[] =>
    apps.map((app) => ({
      candidateId: app.candidate_id,
      applicationId: app.id,
      candidateName: app.candidate?.name ?? "Candidate",
      candidateEmail: app.candidate?.email ?? null,
      jobTitle: app.job?.title ?? null,
      jobId: app.job_id,
    }));

  const toFormRecipients = (apps: Application[]): CandidateFormRecipient[] =>
    apps.map((app) => ({
      candidateId: app.candidate_id,
      candidateName: app.candidate?.name ?? "Candidate",
      candidateEmail: app.candidate?.email ?? null,
    }));

  const kanbanRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const syncingRef = useRef<"top" | "bottom" | null>(null);

  useEffect(() => {
    const el = kanbanRef.current;
    if (!el) return;
    const update = () => setScrollWidth(el.scrollWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c as Element));
    return () => ro.disconnect();
  }, [filtered.length]);

  const handleTopScroll = () => {
    if (syncingRef.current === "bottom") { syncingRef.current = null; return; }
    if (kanbanRef.current && topScrollRef.current) {
      syncingRef.current = "top";
      kanbanRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };
  const handleKanbanScroll = () => {
    if (syncingRef.current === "top") { syncingRef.current = null; return; }
    if (kanbanRef.current && topScrollRef.current) {
      syncingRef.current = "bottom";
      topScrollRef.current.scrollLeft = kanbanRef.current.scrollLeft;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        actions={
          <div className="flex items-center gap-3">
            <Select value={selectedJobFilter} onValueChange={setSelectedJobFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Filter by job" /></SelectTrigger>
              <SelectContent>
                {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative w-52"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search candidates" /></div>
            <Select value={sort} onValueChange={setSort}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="screening_desc">Highest screening</SelectItem><SelectItem value="interview_desc">Highest interview</SelectItem><SelectItem value="newest">Newest</SelectItem><SelectItem value="oldest">Oldest</SelectItem><SelectItem value="name_asc">Candidate name</SelectItem></SelectContent></Select>
            <Sheet><SheetTrigger asChild><Button variant="outline"><SlidersHorizontal className="mr-2 size-4" />Filters{(screeningStatus !== "all" || screeningMin || screeningMax) && <Badge className="ml-2" variant="secondary">{[screeningStatus !== "all", screeningMin, screeningMax].filter(Boolean).length}</Badge>}</Button></SheetTrigger><SheetContent><SheetHeader><SheetTitle>Pipeline filters</SheetTitle><SheetDescription>Filters apply only to the selected job.</SheetDescription></SheetHeader><div className="mt-6 space-y-5"><div className="space-y-2"><Label>Screening status</Label><Select value={screeningStatus} onValueChange={setScreeningStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="final">Final</SelectItem><SelectItem value="provisional">Provisional</SelectItem></SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Minimum score</Label><Input type="number" min={0} max={100} value={screeningMin} onChange={(event) => setScreeningMin(event.target.value)} /></div><div className="space-y-2"><Label>Maximum score</Label><Input type="number" min={0} max={100} value={screeningMax} onChange={(event) => setScreeningMax(event.target.value)} /></div></div><Button variant="outline" className="w-full" onClick={() => { setScreeningStatus("all"); setScreeningMin(""); setScreeningMax(""); }}>Clear all</Button></div></SheetContent></Sheet>
            <ExportRequestDialog exportType="pipeline" filters={exportFilters} disabled={!selectedJobFilter} />
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
            {selectedIds.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Actions
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => openActionDialog("general")}>
                    <Mail className="mr-2 h-4 w-4" />
                    Email Selected
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openFormDialog}>
                    <FileText className="mr-2 h-4 w-4" />
                    Send Form
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openActionDialog("video_screening")}>
                    <Video className="mr-2 h-4 w-4" />
                    Send Video Screening Link
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => openRejectDialog(selectedIds)}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject Candidates
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
      />

      {/* Kanban */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="overflow-x-auto"
          aria-hidden="true"
        >
          <div style={{ width: scrollWidth }} className="h-3" />
        </div>
        <div
          ref={kanbanRef}
          onScroll={handleKanbanScroll}
          className="flex gap-3 overflow-x-auto pb-4 animate-opacity-in"
          style={{ animationDelay: "100ms" }}
        >
          {PIPELINE_STAGES.map(stage => {
            const stageApps = filtered.filter(a => a.stage === stage);
            const allStageAppsSelected = stageApps.length > 0 && stageApps.every((app) => selectedIds.includes(app.id));
            return (
              <Droppable droppableId={stage} key={stage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`kanban-column transition-colors duration-200 ${snapshot.isDraggingOver ? "ring-2 ring-primary/20 bg-primary/5" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full badge-${stage}`} style={{ background: `var(--stage-${stage})` }} />
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{STAGE_LABELS[stage]}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={stageApps.length === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStageSelection(stageApps);
                          }}
                        >
                          {allStageAppsSelected ? "Clear" : "Select all"}
                        </Button>
                        <span className="text-xs text-muted-foreground tabular-nums bg-background/80 rounded-md px-1.5 py-0.5">{stageApps.length}</span>
                      </div>
                    </div>
                    <div className="space-y-2 min-h-[80px]">
                      {stageApps.map((app, idx) => (
                        <Draggable draggableId={app.id} index={idx} key={app.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => setSelectedApp(app)}
                            >
                              <KanbanCard app={app} isDragging={snapshot.isDragging} selected={selectedIds.includes(app.id)} onToggle={toggleSelected} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {stageApps.length === 0 && (
                        <div className="text-xs text-muted-foreground/60 text-center py-6">
                          Drop here
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      {/* Candidate detail panel */}
      {selectedApp && (
        <CandidatePanel
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onStageChange={(newStage) => {
            if (newStage === "rejected") {
              openRejectDialog([selectedApp.id]);
              return;
            }
            moveStageMutation.mutate({ appId: selectedApp.id, newStage: newStage as Stage });
          }}
        />
      )}

      <CandidateEmailComposer
        open={actionDialogOpen}
        purpose={actionPurpose}
        recipients={toEmailRecipients(selectedApps)}
        onOpenChange={setActionDialogOpen}
        onSent={() => setSelectedIds([])}
      />

      <CandidateFormSendDialog
        open={formDialogOpen}
        recipients={toFormRecipients(selectedApps)}
        onOpenChange={setFormDialogOpen}
        onSent={() => setSelectedIds([])}
      />

      <CandidateEmailComposer
        open={rejectDialogOpen}
        mode="rejection"
        recipients={toEmailRecipients(rejectDialogApps)}
        onOpenChange={handleRejectDialogOpenChange}
        onSent={handleRejectSent}
      />
    </div>
  );
}
