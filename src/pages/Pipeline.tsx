import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import KanbanCard from "@/components/pipeline/KanbanCard";
import CandidatePanel from "@/components/pipeline/CandidatePanel";

const STAGES = ["applied", "screening", "scheduling", "1st_interview", "2nd_interview", "offer", "hired", "rejected"] as const;
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

  const filtered = selectedJobFilter === "all" ? applications : applications.filter(a => a.job_id === selectedJobFilter);

  const stageLabels: Record<Stage, string> = {
    applied: "Applied",
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
        </div>
      </div>

      {/* Kanban */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 animate-opacity-in" style={{ animationDelay: "100ms" }}>
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
                      <span className="text-xs text-muted-foreground tabular-nums bg-background/80 rounded-md px-1.5 py-0.5">{stageApps.length}</span>
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
                              <KanbanCard app={app} isDragging={snapshot.isDragging} />
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
    </div>
  );
}
