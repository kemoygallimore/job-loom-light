import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ApplicationHistoryPanel } from "@/features/candidate-profile/components/ApplicationHistoryPanel";
import { CandidateProfileComposers } from "@/features/candidate-profile/components/CandidateProfileComposers";
import { CandidateProfileHeader } from "@/features/candidate-profile/components/CandidateProfileHeader";
import { CandidateProfileLoading } from "@/features/candidate-profile/components/CandidateProfileLoading";
import { CandidateProfileTabs } from "@/features/candidate-profile/components/CandidateProfileTabs";
import {
  errorMessage,
  fetchCandidateProfile,
  getResumeViewUrl,
  updateApplicationStage,
} from "@/features/candidate-profile/api";
import { buildCandidateTimeline } from "@/features/candidate-profile/timeline";
import type { ApplicationWithJob, CandidateProfileData } from "@/features/candidate-profile/types";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { keys } from "@/lib/queryKeys";
import type { PipelineStage } from "@/lib/pipeline";

type Stage = PipelineStage;

export default function CandidateProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [rejectionApplication, setRejectionApplication] = useState<ApplicationWithJob | null>(null);

  const candidateQuery = useQuery({
    queryKey: keys.candidate(id),
    queryFn: () => fetchCandidateProfile(id!),
    enabled: Boolean(id && profile),
  });

  useEffect(() => {
    if (candidateQuery.error) {
      toast.error("Candidate not found");
      navigate("/candidates");
    }
  }, [candidateQuery.error, navigate]);

  const candidate = candidateQuery.data?.candidate ?? null;
  const applications = useMemo(() => candidateQuery.data?.applications ?? [], [candidateQuery.data?.applications]);
  const notes = useMemo(() => candidateQuery.data?.notes ?? [], [candidateQuery.data?.notes]);
  const emailLogs = useMemo(() => candidateQuery.data?.emailLogs ?? [], [candidateQuery.data?.emailLogs]);
  const loading = Boolean(id && profile && candidateQuery.isLoading);

  const updateCandidateDetail = (updater: (current: CandidateProfileData) => CandidateProfileData) => {
    if (!id) return;
    queryClient.setQueryData<CandidateProfileData>(keys.candidate(id), (current) => (current ? updater(current) : current));
  };

  const stageChangeMutation = useMutation({
    mutationFn: ({ appId, newStage }: { appId: string; newStage: Stage }) => updateApplicationStage(appId, newStage),
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to update stage"));
    },
    onSuccess: ({ appId, newStage }) => {
      toast.success(`Stage updated to ${newStage}`);
      updateCandidateDetail((current) => ({
        ...current,
        applications: current.applications.map((a) =>
          a.id === appId ? { ...a, stage: newStage, updated_at: new Date().toISOString() } : a,
        ),
      }));
      if (id) queryClient.invalidateQueries({ queryKey: keys.candidate(id) });
      queryClient.invalidateQueries({ queryKey: [...keys.all, "candidates"] });
      queryClient.invalidateQueries({ queryKey: [...keys.all, "pipeline"] });
    },
  });

  const handleStageChange = (appId: string, newStage: Stage) => {
    if (newStage === "rejected") {
      const application = applications.find((app) => app.id === appId);
      if (!application) {
        toast.error("Application not found");
        return;
      }
      setRejectionApplication(application);
      return;
    }

    stageChangeMutation.mutate({ appId, newStage });
  };

  const handleRejectionComposerOpenChange = (open: boolean) => {
    if (!open) setRejectionApplication(null);
  };

  const handleRejectionSent = (applicationIds: string[]) => {
    const targetIds = new Set(applicationIds.length > 0 ? applicationIds : rejectionApplication ? [rejectionApplication.id] : []);
    updateCandidateDetail((current) => ({
      ...current,
      applications: current.applications.map((app) =>
        targetIds.has(app.id) ? { ...app, stage: "rejected", updated_at: new Date().toISOString() } : app,
      ),
    }));
    setRejectionApplication(null);
    if (id) queryClient.invalidateQueries({ queryKey: keys.candidate(id) });
    queryClient.invalidateQueries({ queryKey: [...keys.all, "candidates"] });
    queryClient.invalidateQueries({ queryKey: [...keys.all, "pipeline"] });
  };

  const handleViewResume = async () => {
    if (!candidate) return;

    try {
      const viewUrl = await getResumeViewUrl(candidate);
      window.open(viewUrl, "_blank", "noopener,noreferrer");
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to load resume");
    }
  };

  const latestApp = applications[0] ?? null;
  const isRepeatApplicant = applications.length > 1;
  const timelineEvents = useMemo(
    () => buildCandidateTimeline(candidate, applications, notes, emailLogs),
    [applications, candidate, emailLogs, notes],
  );

  if (loading) {
    return <CandidateProfileLoading />;
  }

  if (!candidate || !profile) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/candidates")}
        className="gap-2 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Candidates
      </Button>

      <CandidateProfileHeader
        candidate={candidate}
        latestApp={latestApp}
        isRepeatApplicant={isRepeatApplicant}
        onEmailCandidate={() => setEmailComposerOpen(true)}
        onViewResume={handleViewResume}
      />

      <ApplicationHistoryPanel applications={applications} onStageChange={handleStageChange} />

      <CandidateProfileTabs
        applications={applications}
        candidate={candidate}
        latestApp={latestApp}
        notes={notes}
        profile={profile}
        timelineEvents={timelineEvents}
        onNotesChange={(nextNotes) => {
          updateCandidateDetail((current) => ({ ...current, notes: nextNotes }));
          if (id) queryClient.invalidateQueries({ queryKey: keys.candidate(id) });
        }}
      />

      <CandidateProfileComposers
        candidate={candidate}
        emailComposerOpen={emailComposerOpen}
        latestApp={latestApp}
        rejectionApplication={rejectionApplication}
        onEmailComposerOpenChange={setEmailComposerOpen}
        onRejectionComposerOpenChange={handleRejectionComposerOpenChange}
        onRejectionSent={handleRejectionSent}
      />
    </div>
  );
}
