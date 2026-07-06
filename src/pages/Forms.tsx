import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Eye,
  FileText,
  Inbox,
  Link2,
  Pencil,
  Plus,
  Power,
  Trash2,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LeadFormRenderer from "@/components/forms/LeadFormRenderer";
import {
  LeadForm,
  LeadFormSubmission,
  LeadFormUpload,
  answerPreview,
  normalizeSchema,
} from "@/lib/leadForms";
import { resolveFileUrl } from "@/lib/fileUrl";

const FORM_LIMIT = 5;

type QueryResult = { data: unknown; error: { message: string } | null };
type LeadFormsQuery = PromiseLike<QueryResult> & {
  select: (columns?: string) => LeadFormsQuery;
  is: (column: string, value: unknown) => LeadFormsQuery;
  order: (column: string, options?: Record<string, unknown>) => LeadFormsQuery;
  insert: (payload: unknown) => LeadFormsQuery;
  update: (payload: unknown) => LeadFormsQuery;
  eq: (column: string, value: unknown) => LeadFormsQuery;
};
type LeadFormsDb = {
  from: (table: string) => LeadFormsQuery;
};

const leadFormsDb = supabase as unknown as LeadFormsDb;

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function displayStatus(status: LeadForm["status"]) {
  return status === "active" ? "Active" : "Disabled";
}

export default function Forms() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("forms");
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [submissions, setSubmissions] = useState<LeadFormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewForm, setPreviewForm] = useState<LeadForm | null>(null);
  const [submissionFilter, setSubmissionFilter] = useState("all");
  const [selectedSubmission, setSelectedSubmission] = useState<LeadFormSubmission | null>(null);
  const [submissionUploads, setSubmissionUploads] = useState<LeadFormUpload[]>([]);

  const load = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    const [{ data: formRows, error: formError }, { data: submissionRows, error: submissionError }] =
      await Promise.all([
        leadFormsDb
          .from("lead_forms")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        leadFormsDb
          .from("lead_form_submissions")
          .select("*, lead_forms(title)")
          .order("created_at", { ascending: false }),
      ]);

    if (formError) toast.error(formError.message);
    if (submissionError) toast.error(submissionError.message);

    const countMap: Record<string, number> = {};
    (submissionRows ?? []).forEach((submission: LeadFormSubmission) => {
      countMap[submission.form_id] = (countMap[submission.form_id] ?? 0) + 1;
    });

    setForms(
      ((formRows ?? []) as LeadForm[]).map((form) => ({
        ...form,
        schema: normalizeSchema(form.schema),
        submission_count: countMap[form.id] ?? 0,
      })),
    );
    setSubmissions(
      ((submissionRows ?? []) as LeadFormSubmission[]).map((submission) => ({
        ...submission,
        schema_snapshot: normalizeSchema(submission.schema_snapshot),
      })),
    );
    setLoading(false);
  }, [profile?.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredSubmissions = useMemo(() => {
    if (submissionFilter === "all") return submissions;
    return submissions.filter((submission) => submission.form_id === submissionFilter);
  }, [submissionFilter, submissions]);

  const openCreate = () => {
    if (!profile?.company_id || !user?.id) return;
    if (forms.length >= FORM_LIMIT) {
      toast.error("You have reached the 5-form limit. Delete a form to create another one.");
      return;
    }
    navigate("/forms/new");
  };

  const openEdit = (form: LeadForm) => {
    navigate(`/forms/${form.id}/edit`);
  };

  const copyLink = async (form: LeadForm) => {
    const url = `${window.location.origin}/forms/${form.public_id}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(form.id);
    toast.success("Form link copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleStatus = async (form: LeadForm) => {
    const nextStatus = form.status === "active" ? "disabled" : "active";
    const { error } = await leadFormsDb.from("lead_forms").update({ status: nextStatus }).eq("id", form.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Form ${nextStatus === "active" ? "enabled" : "disabled"}`);
    load();
  };

  const softDelete = async (form: LeadForm) => {
    const { error } = await leadFormsDb
      .from("lead_forms")
      .update({ deleted_at: new Date().toISOString(), status: "disabled" })
      .eq("id", form.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Form deleted");
    load();
  };

  const viewSubmissionsFor = (form: LeadForm) => {
    setSubmissionFilter(form.id);
    setTab("submissions");
  };

  const openSubmission = async (submission: LeadFormSubmission) => {
    setSelectedSubmission(submission);
    const { data } = await leadFormsDb
      .from("lead_form_uploads")
      .select("*")
      .eq("submission_id", submission.id)
      .order("created_at", { ascending: true });
    setSubmissionUploads((data as LeadFormUpload[]) ?? []);

    if (submission.status === "new") {
      await leadFormsDb.from("lead_form_submissions").update({ status: "reviewed" }).eq("id", submission.id);
      setSubmissions((current) =>
        current.map((item) => (item.id === submission.id ? { ...item, status: "reviewed" } : item)),
      );
    }
  };

  const openUpload = async (upload: LeadFormUpload) => {
    try {
      const url = await resolveFileUrl(upload.object_key, upload.bucket);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not open file"));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-in">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileText className="size-6 text-primary" />
            Forms
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Create standalone lead forms and review submissions.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          New Form
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="forms">Forms</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
          </TabsList>
          <div className="text-sm text-muted-foreground">{forms.length} of {FORM_LIMIT} forms used</div>
        </div>

        <TabsContent value="forms" className="mt-4">
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Form</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Submissions</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="w-56 font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell>
                      <div className="font-medium">{form.title}</div>
                      <div className="max-w-sm truncate text-sm text-muted-foreground">
                        {form.description || "No description"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={form.status === "active" ? "default" : "secondary"}>
                        {displayStatus(form.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{form.submission_count ?? 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {format(new Date(form.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => copyLink(form)} title="Copy link">
                          {copiedId === form.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => setPreviewForm(form)} title="Preview">
                          <Eye className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(form)} title="Edit">
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => toggleStatus(form)} title="Enable or disable">
                          <Power className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => viewSubmissionsFor(form)} title="Submissions">
                          <Inbox className="size-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8" title="Delete">
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this form?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This hides the form and disables its public link, but keeps submission history.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => softDelete(form)}
                              >
                                Delete form
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && forms.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      No forms yet. Create your first lead form to get a shareable link.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="submissions" className="mt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Select value={submissionFilter} onValueChange={setSubmissionFilter}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Filter by form" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All forms</SelectItem>
                {forms.map((form) => (
                  <SelectItem key={form.id} value={form.id}>
                    {form.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">{filteredSubmissions.length} submissions</div>
          </div>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Submission</TableHead>
                  <TableHead className="font-semibold">Form</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Submitted</TableHead>
                  <TableHead className="w-24 font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell>
                      <div className="font-medium">
                        {answerPreview(submission.answers.full_name ?? submission.answers.name ?? submission.answers.email)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {answerPreview(submission.answers.email ?? submission.answers.phone)}
                      </div>
                    </TableCell>
                    <TableCell>{submission.lead_forms?.title ?? "Deleted form"}</TableCell>
                    <TableCell>
                      <Badge variant={submission.status === "new" ? "default" : "secondary"}>
                        {submission.status === "new" ? "New" : "Reviewed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {format(new Date(submission.created_at), "MMM d, yyyy h:mm a")}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openSubmission(submission)}>
                        <Eye className="size-4" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filteredSubmissions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      No submissions match this view.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(previewForm)} onOpenChange={(open) => !open && setPreviewForm(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewForm?.title ?? "Preview form"}</DialogTitle>
          </DialogHeader>
          {previewForm && (
            <div className="flex flex-col gap-5">
              {previewForm.description && <p className="text-sm text-muted-foreground">{previewForm.description}</p>}
              <LeadFormRenderer schema={previewForm.schema} values={{}} disabled onChange={() => {}} />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Link2 className="size-4" />
                  Public link preview
                </div>
                <Link className="font-medium text-primary hover:underline" to={`/forms/${previewForm.public_id}`} target="_blank">
                  Open public form
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedSubmission)} onOpenChange={(open) => !open && setSelectedSubmission(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submission details</DialogTitle>
          </DialogHeader>
          {selectedSubmission && (
            <div className="flex flex-col gap-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedSubmission.schema_snapshot.fields
                  .filter((field) => field.type !== "section")
                  .map((field) => (
                    <div key={field.id} className="rounded-lg border bg-background p-3">
                      <div className="text-xs font-medium text-muted-foreground">{field.label}</div>
                      <div className="mt-1 text-sm">{answerPreview(selectedSubmission.answers[field.id])}</div>
                    </div>
                  ))}
              </div>
              {submissionUploads.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Uploads</h3>
                  {submissionUploads.map((upload) => (
                    <div key={upload.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{upload.file_name}</div>
                        <div className="text-xs text-muted-foreground">{Math.ceil(upload.file_size / 1024)} KB</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openUpload(upload)}>
                        <Upload className="size-4" />
                        Open
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
