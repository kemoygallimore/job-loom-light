import { useEffect, useMemo, useState } from "react";
import { addDays, format, isAfter } from "date-fns";
import {
  CalendarClock,
  CalendarIcon,
  ListChecks,
  Loader2,
  LockKeyhole,
  Sparkles,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import ScreeningQuestionBuilder, {
  cloneDraftQuestions,
  createDraftQuestion,
  type DraftQuestion,
  type ScreeningEditorStatus,
} from "@/components/jobs/ScreeningQuestionBuilder";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type JobStatus = Database["public"]["Enums"]["job_status"];

interface Props {
  companyId: string;
  maxOpenJobs: number;
  onOpenChange: (open: boolean) => void;
  onOpenLimitDialog?: () => void;
  onSaved: () => Promise<void> | void;
  open: boolean;
  openJobsCount: number;
  job: JobRow | null;
  userId: string;
}

interface ScreeningQuestionRow {
  id: string;
  prompt: string;
  type: Database["public"]["Enums"]["screening_question_type"];
  rubric: Record<string, string> | null;
}

const defaultVideoQuestion = "Tell us about yourself and why you're interested in this role.";

function defaultExpiryDate() {
  return addDays(new Date(), 7);
}

export default function JobEditorDialog({
  companyId,
  maxOpenJobs,
  onOpenChange,
  onOpenLimitDialog,
  onSaved,
  open,
  openJobsCount,
  job,
  userId,
}: Props) {
  const [activeTab, setActiveTab] = useState("details");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hiringManager, setHiringManager] = useState("");
  const [status, setStatus] = useState<JobStatus>("open");
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(defaultExpiryDate());
  const [videoQuestion, setVideoQuestion] = useState(defaultVideoQuestion);

  const [screeningVersionId, setScreeningVersionId] = useState<string | null>(null);
  const [screeningVersion, setScreeningVersion] = useState(1);
  const [screeningStatus, setScreeningStatus] = useState<ScreeningEditorStatus>("draft");
  const [screeningQuestions, setScreeningQuestions] = useState<DraftQuestion[]>([]);

  const resetState = () => {
    setActiveTab("details");
    setTitle("");
    setDescription("");
    setHiringManager("");
    setStatus("open");
    setExpiresAt(defaultExpiryDate());
    setVideoQuestion(defaultVideoQuestion);
    setScreeningVersionId(null);
    setScreeningVersion(1);
    setScreeningStatus("draft");
    setScreeningQuestions([]);
  };

  useEffect(() => {
    if (!open) {
      resetState();
      setLoading(false);
      setSaving(false);
      return;
    }

    let ignore = false;

    const load = async () => {
      setLoading(true);

      if (!job) {
        resetState();
        setLoading(false);
        return;
      }

      setTitle(job.title);
      setDescription(job.description ?? "");
      setHiringManager(job.hiring_manager ?? "");
      setStatus(job.status);
      setExpiresAt(job.expires_at ? new Date(job.expires_at) : defaultExpiryDate());

      const [{ data: screeningJobRow }, { data: versionRow }] = await Promise.all([
        supabase
          .from("screening_jobs")
          .select("id, question")
          .eq("job_id", job.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("job_screening_versions")
          .select("id, version, status")
          .eq("job_id", job.id)
          .in("status", ["draft", "published", "locked"])
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (ignore) return;

      setVideoQuestion(screeningJobRow?.question ?? defaultVideoQuestion);

      if (!versionRow) {
        setScreeningVersionId(null);
        setScreeningVersion(1);
        setScreeningStatus("draft");
        setScreeningQuestions([]);
        setLoading(false);
        return;
      }

      const { data: questionRows } = await supabase
        .from("job_screening_questions")
        .select("id, prompt, type, rubric")
        .eq("version_id", versionRow.id)
        .order("position");

      const questionIds = (questionRows ?? []).map((question) => question.id);
      const { data: choiceRows } = questionIds.length
        ? await supabase
            .from("job_screening_choices")
            .select("id, question_id, label, credit_percent")
            .in("question_id", questionIds)
            .order("position")
        : { data: [] };

      if (ignore) return;

      setScreeningVersionId(versionRow.id);
      setScreeningVersion(versionRow.version);
      setScreeningStatus(versionRow.status as ScreeningEditorStatus);
      setScreeningQuestions(
        ((questionRows ?? []) as ScreeningQuestionRow[]).map((question) => ({
          id: question.id,
          prompt: question.prompt,
          type: question.type,
          rubric: question.rubric,
          choices: (choiceRows ?? [])
            .filter((choice) => choice.question_id === question.id)
            .map((choice) => ({
              id: choice.id,
              label: choice.label,
              credit_percent: choice.credit_percent,
            })),
        })),
      );
      setLoading(false);
    };

    load().catch((error: { message?: string }) => {
      if (ignore) return;
      toast.error(error.message ?? "Could not load job settings");
      setLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [job, open]);

  const screeningSummary = useMemo(() => {
    if (screeningQuestions.length === 0 && !screeningVersionId) {
      return {
        badge: "Not set up",
        tone: "secondary" as const,
        helper: "Add scored questions to rank applicants automatically in the pipeline.",
      };
    }

    if (screeningStatus === "locked") {
      return {
        badge: "Locked",
        tone: "default" as const,
        helper: "Applicants have already started this version. Create a corrected draft for future applicants.",
      };
    }

    if (screeningStatus === "published") {
      return {
        badge: "Published",
        tone: "default" as const,
        helper: "Applicants will see these questions on the public application.",
      };
    }

    return {
      badge: "Draft",
      tone: "secondary" as const,
      helper: "Save now and publish when the questions are ready to go live.",
    };
  }, [screeningQuestions.length, screeningStatus, screeningVersionId]);

  const expiresLabel = expiresAt ? format(expiresAt, "PPP") : "Pick a date";
  const isExpired = expiresAt ? !isAfter(expiresAt, new Date()) : false;
  const readOnlyScreening = screeningStatus === "locked";

  const validateScreeningQuestions = () => {
    if (screeningQuestions.length === 0) {
      if (screeningVersionId) {
        toast.error("Keep at least one screening question when a scored screening is already set up.");
        setActiveTab("screening");
        return false;
      }

      if (screeningStatus === "published") {
        toast.error("Add at least one screening question before publishing.");
        setActiveTab("screening");
        return false;
      }

      return true;
    }

    if (screeningQuestions.some((question) => !question.prompt.trim())) {
      toast.error("Each screening question needs a prompt.");
      setActiveTab("screening");
      return false;
    }

    if (
      screeningQuestions.some(
        (question) =>
          ["yes_no", "single_choice", "multi_select"].includes(question.type) &&
          (question.choices.length < 2 || question.choices.some((choice) => !choice.label.trim())),
      )
    ) {
      toast.error("Choice questions need at least two labeled answers.");
      setActiveTab("screening");
      return false;
    }

    return true;
  };

  const handleScreeningQuestionsChange = (nextQuestions: DraftQuestion[]) => {
    setScreeningQuestions(nextQuestions);

    if (!screeningVersionId && screeningQuestions.length === 0 && nextQuestions.length > 0) {
      setScreeningStatus("published");
    }
  };

  const persistScreeningConfig = async (jobId: string) => {
    if (screeningQuestions.length === 0) return;
    if (screeningStatus === "locked") return;

    let targetVersionId = screeningVersionId;
    const publishNow = screeningStatus === "published";

    if (!targetVersionId) {
      const { data, error } = await supabase
        .from("job_screening_versions")
        .insert({
          company_id: companyId,
          job_id: jobId,
          version: screeningVersion,
          created_by: userId,
          status: publishNow ? "published" : "draft",
          published_at: publishNow ? new Date().toISOString() : null,
        })
        .select("id")
        .single();

      if (error) throw error;
      targetVersionId = data.id;
      setScreeningVersionId(data.id);
    } else {
      const { error } = await supabase
        .from("job_screening_versions")
        .update({
          status: publishNow ? "published" : "draft",
          published_at: publishNow ? new Date().toISOString() : null,
        })
        .eq("id", targetVersionId);

      if (error) throw error;
    }

    const { error: deleteQuestionsError } = await supabase
      .from("job_screening_questions")
      .delete()
      .eq("version_id", targetVersionId);

    if (deleteQuestionsError) throw deleteQuestionsError;

    for (let questionIndex = 0; questionIndex < screeningQuestions.length; questionIndex += 1) {
      const question = screeningQuestions[questionIndex];
      const { error: questionError } = await supabase.from("job_screening_questions").insert({
        id: question.id,
        version_id: targetVersionId,
        position: questionIndex,
        type: question.type,
        prompt: question.prompt.trim(),
        rubric: question.rubric,
        settings: {},
      });

      if (questionError) throw questionError;

      if (["yes_no", "single_choice", "multi_select"].includes(question.type)) {
        const { error: choiceError } = await supabase.from("job_screening_choices").insert(
          question.choices.map((choice, choiceIndex) => ({
            id: choice.id,
            question_id: question.id,
            position: choiceIndex,
            label: choice.label.trim(),
            credit_percent: choice.credit_percent,
          })),
        );

        if (choiceError) throw choiceError;
      }
    }
  };

  const persistVideoScreening = async (jobId: string) => {
    const { data: existing } = await supabase
      .from("screening_jobs")
      .select("id")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("screening_jobs")
        .update({
          title: title.trim(),
          question: videoQuestion.trim(),
          expires_at: expiresAt?.toISOString(),
        })
        .eq("id", existing.id);

      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("screening_jobs").insert({
      company_id: companyId,
      created_by: userId,
      title: title.trim(),
      question: videoQuestion.trim(),
      expires_at: expiresAt?.toISOString() ?? defaultExpiryDate().toISOString(),
      job_id: jobId,
    });

    if (error) throw error;
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Add a job title before saving.");
      setActiveTab("details");
      return;
    }

    if (!expiresAt) {
      toast.error("Choose an expiration date.");
      setActiveTab("details");
      return;
    }

    if (isAfter(expiresAt, addDays(new Date(), 30))) {
      toast.error("Expiration date cannot exceed 30 days from today.");
      setActiveTab("details");
      return;
    }

    if (!validateScreeningQuestions()) return;

    const willBeOpen = status === "open";
    const wasOpen = job?.status === "open";
    const wouldAddOpenJob = willBeOpen && (!job || !wasOpen);
    if (wouldAddOpenJob && openJobsCount >= maxOpenJobs) {
      onOpenLimitDialog?.();
      return;
    }

    setSaving(true);

    try {
      let jobId = job?.id;

      if (job) {
        const { error } = await supabase
          .from("jobs")
          .update({
            title: title.trim(),
            description: description || null,
            hiring_manager: hiringManager.trim() || null,
            status,
            expires_at: expiresAt.toISOString(),
          })
          .eq("id", job.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("jobs")
          .insert({
            company_id: companyId,
            title: title.trim(),
            description: description || null,
            hiring_manager: hiringManager.trim() || null,
            status,
            expires_at: expiresAt.toISOString(),
          })
          .select("id")
          .single();

        if (error) throw error;
        jobId = data.id;
      }

      if (!jobId) throw new Error("Could not determine the job id.");

      await persistVideoScreening(jobId);
      await persistScreeningConfig(jobId);

      toast.success(job ? "Job updated" : "Job created");
      onOpenChange(false);
      await onSaved();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not save the job";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const cloneLockedScreening = () => {
    setScreeningVersionId(null);
    setScreeningVersion((current) => current + 1);
    setScreeningStatus("draft");
    setScreeningQuestions(cloneDraftQuestions(screeningQuestions));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 top-0 flex h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:rounded-none">
        <div className="flex h-full w-full flex-col bg-background">
          <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle>{job ? "Edit job" : "Create job"}</DialogTitle>
                  <Badge variant={screeningSummary.tone}>{screeningSummary.badge}</Badge>
                  {isExpired ? <Badge variant="outline">Expired</Badge> : null}
                </div>
                <DialogDescription>
                  Manage the role, expiration date, video screening, and scored questions in one place.
                </DialogDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <CalendarClock className="size-3.5" />
                  Expires {expiresLabel}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b px-6 py-3">
              <TabsList>
                <TabsTrigger value="details">Job details</TabsTrigger>
                <TabsTrigger value="screening">Screening</TabsTrigger>
              </TabsList>
            </div>

            {loading ? (
              <div className="flex min-h-0 flex-1 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading job settings...
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                {activeTab === "details" ? (
                  <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-24 pt-6">
                    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_320px]">
                      <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                          <Label>Job title</Label>
                          <Input
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Frontend Developer"
                          />
                        </div>

                        <div className="flex flex-col gap-2">
                          <Label>Description</Label>
                          <RichTextEditor
                            value={description}
                            onChange={setDescription}
                            placeholder="Describe the role, responsibilities, and requirements..."
                          />
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                          <div className="flex flex-col gap-2">
                            <Label>Hiring manager</Label>
                            <Input
                              value={hiringManager}
                              onChange={(event) => setHiringManager(event.target.value)}
                              placeholder="Jane Smith"
                            />
                          </div>

                          <div className="flex flex-col gap-2">
                            <Label>Status</Label>
                            <Select value={status} onValueChange={(value) => setStatus(value as JobStatus)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-5">
                        <div className="flex items-center gap-2">
                          <CalendarClock className="size-4 text-muted-foreground" />
                          <p className="font-medium">Availability</p>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Label>Expiration date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  "justify-start text-left font-normal",
                                  !expiresAt && "text-muted-foreground",
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {expiresLabel}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={expiresAt}
                                onSelect={setExpiresAt}
                                disabled={(date) => date < new Date() || date > addDays(new Date(), 30)}
                                initialFocus
                                className="pointer-events-auto p-3"
                              />
                            </PopoverContent>
                          </Popover>
                          <p className="text-xs text-muted-foreground">
                            This one date controls both the public job listing and the linked video-screening entry.
                          </p>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <ListChecks className="size-4 text-muted-foreground" />
                            <p className="font-medium">Screening setup</p>
                          </div>
                          <p className="text-sm text-muted-foreground">{screeningSummary.helper}</p>
                          <Button type="button" variant="outline" onClick={() => setActiveTab("screening")}>
                            <Sparkles className="mr-2 size-4" />
                            Open screening setup
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeTab === "screening" ? (
                  <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pb-24 pt-6">
                    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_320px] [@media_(max-height:760px)]:lg:grid-cols-1">
                      <div className="flex min-w-0 flex-col gap-6">
                        <div className="rounded-lg border bg-muted/20 p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <ListChecks className="size-4 text-muted-foreground" />
                                <p className="font-medium">Scored applicant screening</p>
                              </div>
                              <p className="text-sm text-muted-foreground">{screeningSummary.helper}</p>
                            </div>
                            <Badge variant={screeningSummary.tone}>{screeningSummary.badge}</Badge>
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-[200px_1fr] md:items-start">
                            <div className="flex flex-col gap-2">
                              <Label>Availability</Label>
                              <Select
                                disabled={readOnlyScreening}
                                value={screeningStatus}
                                onValueChange={(value) => setScreeningStatus(value as ScreeningEditorStatus)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="draft">Draft</SelectItem>
                                  <SelectItem
                                    value="published"
                                    disabled={screeningQuestions.length === 0}
                                  >
                                    Published
                                  </SelectItem>
                                  {readOnlyScreening ? <SelectItem value="locked">Locked</SelectItem> : null}
                                </SelectContent>
                              </Select>
                            </div>

                            {readOnlyScreening ? (
                              <div className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2 font-medium text-foreground">
                                  <LockKeyhole className="size-4" />
                                  Live responses have locked this version
                                </div>
                                <p className="mt-1">
                                  Create a corrected draft to update future applicants without changing existing scores.
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="mt-3"
                                  onClick={cloneLockedScreening}
                                >
                                  Create corrected draft
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <ScreeningQuestionBuilder
                          questions={screeningQuestions}
                          status={screeningStatus}
                          version={screeningVersion}
                          onQuestionsChange={handleScreeningQuestionsChange}
                        />
                      </div>

                      <div className="flex min-w-0 flex-col gap-4 rounded-lg border bg-muted/20 p-5">
                        <div className="flex items-center gap-2">
                          <Video className="size-4 text-muted-foreground" />
                          <p className="font-medium">Video screening</p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Candidates who receive the video-screening link will answer this prompt, and the same expiration
                          date from the job details tab applies here automatically.
                        </p>
                        <div className="flex flex-col gap-2">
                          <Label>Video question</Label>
                          <Textarea
                            value={videoQuestion}
                            onChange={(event) => setVideoQuestion(event.target.value)}
                            rows={6}
                            placeholder="Tell us about yourself and why you're interested in this role."
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </Tabs>

          <div className="shrink-0 border-t px-6 py-4">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Public candidates can only apply while the job is open and before the expiration date.
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  {job ? "Save changes" : "Create job"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
