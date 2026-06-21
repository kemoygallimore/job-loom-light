import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import KanbanCard from "@/components/pipeline/KanbanCard";
import CandidatePanel from "@/components/pipeline/CandidatePanel";
import BulkProgressDialog from "@/components/pipeline/BulkProgressDialog";

const STAGES = ["applied", "shortlisted", "screening", "scheduling", "1st_interview", "2nd_interview", "offer", "hired", "rejected"] as const;
type Stage = typeof STAGES[number];

export interface Application {
  id: string;
  job_id: string;
  candidate_id: string;
  stage: Stage;
  company_id: string;
  candidate: { name: string; email: string | null };
  job: { title: string; hiring_manager: string | null };
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
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [matchingConfirmOpen, setMatchingConfirmOpen] = useState(false);
  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [matchingTyped, setMatchingTyped] = useState("");
  const [stageConfirmOpen, setStageConfirmOpen] = useState(false);
  const [stageToReject, setStageToReject] = useState<Stage | null>(null);
  const [stageMatchingCount, setStageMatchingCount] = useState<number | null>(null);
  const [currentBulkActionId, setCurrentBulkActionId] = useState<string | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("applications")
      .select("id, job_id, candidate_id, stage, company_id, candidates(name, email), jobs(title, hiring_manager)")
      .order("created_at", { ascending: false });

    const mapped = (data ?? []).map((d: any) => ({
      ...d,
      candidate: d.candidates,
      job: d.jobs,
    }));
    setApplications(mapped as Application[]);
  }, []);

  const loadOptions = useCallback(async () => {
    const [j, c] = await Promise.all([
      supabase.from("jobs").select("id, title").eq("status", "open"),
      supabase.from("candidates").select("id, name"),
    ]);
    setJobs((j.data as any[]) ?? []);
    setCandidates((c.data as any[]) ?? []);
  }, []);

  useEffect(() => {
    if (profile) {
      load();
      loadOptions();
    }
  }, [profile, load, loadOptions]);

  const moveStage = async (appId: string, newStage: Stage) => {
    const { error } = await supabase.from("applications").update({ stage: newStage }).eq("id", appId);
    if (error) {
      toast.error(error.message);
      load(); // revert
      return;
    }
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, stage: newStage } : a));
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    const newStage = destination.droppableId as Stage;
    const app = applications.find(a => a.id === draggableId);
    if (!app || app.stage === newStage) return;
    // Optimistic update
    setApplications(prev => prev.map(a => a.id === draggableId ? { ...a, stage: newStage } : a));
    moveStage(draggableId, newStage);
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

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter(x => x !== id);
    });
  };

  const clearSelection = () => setSelectedIds([]);

  const handleBulkReject = async () => {
    if (!profile) return;
    if (selectedIds.length === 0) return;
    setConfirmOpen(false);
    const payload = { ids: selectedIds, company_id: profile.company_id };
    const { data, error } = await supabase.functions.invoke("bulk-reject-applications", { body: payload });
    if (error) {
      toast.error(error.message);
      return;
    }
    const bulkId = (data as any)?.bulk_action_id ?? null;
    if (bulkId) {
      setCurrentBulkActionId(bulkId);
      setBulkDialogOpen(true);
    }
    // optimistic UX update
    setApplications(prev => prev.map(a => selectedIds.includes(a.id) ? { ...a, stage: "rejected" as any } : a));
    toast.success(`Started rejecting ${selectedIds.length} candidates`);
    clearSelection();
  };

  const confirmThreshold = 50;

  const handleRejectAllMatchingClick = async () => {
    if (!profile) return;
    // Build simple filter for server (only job filter supported for now)
    const filter: any = {};
    if (selectedJobFilter !== "all") filter.job_id = selectedJobFilter;

    const { data, error } = await supabase.functions.invoke("bulk-reject-applications", {
      body: { filter, company_id: profile.company_id, dryRun: true },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const total = (data as any)?.total ?? 0;
    setMatchingCount(total);
    setMatchingTyped("");
    setMatchingConfirmOpen(true);
  };

  const handleStageRejectClick = async (stage: Stage) => {
    if (!profile) return;
    const filter: any = { stage };

    const { data, error } = await supabase.functions.invoke("bulk-reject-applications", {
      body: { filter, company_id: profile.company_id, dryRun: true },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const total = (data as any)?.total ?? 0;
    if (total === 0) {
      toast(`No candidates found in ${stageLabels[stage]} stage`);
      return;
    }
    setStageMatchingCount(total);
    setStageToReject(stage);
    setStageConfirmOpen(true);
  };

  const handleConfirmRejectStage = async () => {
    if (!profile || !stageToReject) return;
    const filter: any = { stage: stageToReject };
    const { data, error } = await supabase.functions.invoke("bulk-reject-applications", {
      body: { filter, company_id: profile.company_id },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const bulkId = (data as any)?.bulk_action_id ?? null;
    if (bulkId) {
      setCurrentBulkActionId(bulkId);
      setBulkDialogOpen(true);
    }
    toast.success(`Started rejecting ${stageMatchingCount ?? 0} candidate${(stageMatchingCount ?? 0) === 1 ? '' : 's'}`);
    setStageConfirmOpen(false);
    setStageToReject(null);
    setStageMatchingCount(null);
  };

  const handleConfirmRejectMatching = async () => {
    if (!profile || matchingCount === null) return;
    const filter: any = {};
    if (selectedJobFilter !== "all") filter.job_id = selectedJobFilter;
    const { data, error } = await supabase.functions.invoke("bulk-reject-applications", {
      body: { filter, company_id: profile.company_id },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const bulkId = (data as any)?.bulk_action_id ?? null;
    if (bulkId) {
      setCurrentBulkActionId(bulkId);
      setBulkDialogOpen(true);
    }
    toast.success(`Started rejecting ${matchingCount} candidates`);
    setMatchingConfirmOpen(false);
    setMatchingCount(null);
    // load() will run when job completes via onComplete
  };

  const filtered = selectedJobFilter === "all" ? applications : applications.filter(a => a.job_id === selectedJobFilter);

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

  const stageLabels: Record<Stage, string> = {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 animate-fade-in">
        <h1 className="text-2xl font-bold">Pipeline</h1>
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
          <Button onClick={() => setSelectedIds(filtered.map(a => a.id))} disabled={filtered.length === 0}>
            Select all visible ({filtered.length})
          </Button>
          <Button onClick={handleRejectAllMatchingClick} disabled={applications.length === 0} className="bg-destructive text-destructive-foreground">
            Reject all matching
          </Button>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button className="bg-destructive text-destructive-foreground" disabled={selectedIds.length === 0}>
                  Reject selected
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject {selectedIds.length} candidate{selectedIds.length === 1 ? "" : "s"}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will move the selected candidates to the rejected stage. This action can be undone by changing their stage manually.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={handleBulkReject}>
                    Yes, reject
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={matchingConfirmOpen} onOpenChange={setMatchingConfirmOpen}>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject {matchingCount ?? 0} matching candidate{(matchingCount ?? 0) === 1 ? "" : "s"}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will move matching candidates to the rejected stage. This action can be undone if you have audit records enabled.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {matchingCount !== null && matchingCount > confirmThreshold && (
                  <div className="p-3">
                    <Label>Type <span className="font-mono">REJECT</span> to confirm</Label>
                    <Input value={matchingTyped} onChange={(e) => setMatchingTyped((e.target as HTMLInputElement).value)} />
                  </div>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground"
                    onClick={handleConfirmRejectMatching}
                    disabled={matchingCount !== null && matchingCount > confirmThreshold && matchingTyped !== "REJECT"}
                  >
                    Yes, reject
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={stageConfirmOpen} onOpenChange={setStageConfirmOpen}>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject {stageMatchingCount ?? 0} candidate{(stageMatchingCount ?? 0) === 1 ? "" : "s"} in {stageToReject ? stageLabels[stageToReject] : 'this stage'}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will move all candidates in this stage to the rejected stage. This action can be undone using the audit undo flow.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={handleConfirmRejectStage}>
                    Yes, reject
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
      </div>

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
          {STAGES.map(stage => {
            const stageApps = filtered.filter(a => a.stage === stage);
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
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stageLabels[stage]}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums bg-background/80 rounded-md px-1.5 py-0.5">{stageApps.length}</span>
                        {stage !== "rejected" && (
                          <Button
                            className="bg-destructive text-destructive-foreground text-xs px-2 py-1"
                            onClick={(e) => { e.stopPropagation(); handleStageRejectClick(stage); }}
                            disabled={stageApps.length === 0}
                          >
                            Reject all
                          </Button>
                        )}
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
            moveStage(selectedApp.id, newStage as Stage);
            setSelectedApp({ ...selectedApp, stage: newStage as Stage });
          }}
        />
      )}
      <BulkProgressDialog
        bulkActionId={currentBulkActionId}
        isOpen={bulkDialogOpen}
        onClose={() => setBulkDialogOpen(false)}
        onComplete={() => { setBulkDialogOpen(false); setCurrentBulkActionId(null); load(); }}
      />
    </div>
  );
}
