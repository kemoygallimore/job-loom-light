import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Eye,
  FileText,
  Inbox,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import LeadFormRenderer from "@/components/forms/LeadFormRenderer";
import { LeadForm, LeadFormSubmission, normalizeSchema } from "@/lib/leadForms";
import PageHeader from "@/components/shared/PageHeader";
import { deleteCandidateForm } from "@/lib/candidateFormInvitations";
import { deleteObjects } from "@/lib/storage";

const FORM_LIMIT = 5;

type QueryResult = { data: unknown; error: { message: string } | null };
type LeadFormsQuery = PromiseLike<QueryResult> & {
  select: (columns?: string) => LeadFormsQuery;
  is: (column: string, value: unknown) => LeadFormsQuery;
  order: (column: string, options?: Record<string, unknown>) => LeadFormsQuery;
  update: (payload: unknown) => LeadFormsQuery;
  eq: (column: string, value: unknown) => LeadFormsQuery;
};
type LeadFormsDb = {
  from: (table: string) => LeadFormsQuery;
};
type DeleteCounts = {
  submissions: number;
  assignments: number;
  uploads: number;
};
type UploadRow = {
  bucket: string;
  object_key: string;
};

const leadFormsDb = supabase as unknown as LeadFormsDb;

function displayStatus(status: LeadForm["status"]) {
  return status === "active" ? "Active" : "Disabled";
}

export default function Forms() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewForm, setPreviewForm] = useState<LeadForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadForm | null>(null);
  const [deleteCounts, setDeleteCounts] = useState<DeleteCounts | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.company_id) {
      setForms([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: formRows, error: formError }, { data: submissionRows, error: submissionError }] =
      await Promise.all([
        leadFormsDb
          .from("lead_forms")
          .select("*")
          .eq("company_id", profile.company_id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        leadFormsDb
          .from("lead_form_submissions")
          .select("form_id")
          .eq("company_id", profile.company_id)
          .order("created_at", { ascending: false }),
      ]);

    if (formError) toast.error(formError.message);
    if (submissionError) toast.error(submissionError.message);

    const countMap: Record<string, number> = {};
    ((submissionRows ?? []) as Pick<LeadFormSubmission, "form_id">[]).forEach((submission) => {
      countMap[submission.form_id] = (countMap[submission.form_id] ?? 0) + 1;
    });

    setForms(
      ((formRows ?? []) as LeadForm[]).map((form) => ({
        ...form,
        schema: normalizeSchema(form.schema),
        submission_count: countMap[form.id] ?? 0,
      })),
    );
    setLoading(false);
  }, [profile?.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    if (!profile?.company_id || !user?.id) return;
    if (forms.length >= FORM_LIMIT) {
      toast.error("You have reached the 5-form limit. Delete a form to create another one.");
      return;
    }
    navigate("/forms/new");
  };

  const toggleStatus = async (form: LeadForm) => {
    if (!profile?.company_id) return;
    const nextStatus = form.status === "active" ? "disabled" : "active";
    const { error } = await leadFormsDb
      .from("lead_forms")
      .update({ status: nextStatus })
      .eq("id", form.id)
      .eq("company_id", profile.company_id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Form ${nextStatus === "active" ? "enabled" : "disabled"}`);
    load();
  };

  const prepareDelete = async (form: LeadForm) => {
    if (!profile?.company_id) return;
    setDeleteTarget(form);
    setDeleteCounts(null);
    setDeleteLoading(true);
    const [{ data: submissions }, { data: assignments }, { data: uploads }] = await Promise.all([
      supabase.from("lead_form_submissions").select("id").eq("form_id", form.id).eq("company_id", profile.company_id),
      supabase.from("candidate_form_assignments").select("id").eq("form_id", form.id).eq("company_id", profile.company_id),
      supabase.from("lead_form_uploads").select("id").eq("form_id", form.id).eq("company_id", profile.company_id),
    ]);
    setDeleteCounts({
      submissions: submissions?.length ?? 0,
      assignments: assignments?.length ?? 0,
      uploads: uploads?.length ?? 0,
    });
    setDeleteLoading(false);
  };

  const hardDelete = async () => {
    if (!deleteTarget || !profile?.company_id || deleting) return;
    setDeleting(true);
    try {
      const { data: uploads, error: uploadsError } = await supabase
        .from("lead_form_uploads")
        .select("bucket, object_key")
        .eq("form_id", deleteTarget.id)
        .eq("company_id", profile.company_id);
      if (uploadsError) throw new Error(uploadsError.message);

      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      const byBucket = new Map<string, string[]>();
      ((uploads ?? []) as UploadRow[]).forEach((upload) => {
        if (!upload.object_key) return;
        const keys = byBucket.get(upload.bucket) ?? [];
        keys.push(upload.object_key);
        byBucket.set(upload.bucket, keys);
      });

      for (const [bucket, keys] of byBucket) {
        await deleteObjects(bucket, keys, accessToken);
      }

      await deleteCandidateForm(deleteTarget.id);
      toast.success("Form and related data deleted");
      setDeleteTarget(null);
      setDeleteCounts(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete form");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <>
            <FileText className="size-6 text-primary" />
            Forms
          </>
        }
        description="Build reusable forms, then assign them from a candidate profile."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New Form
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-sm">
        <div>
          <span className="font-medium">{forms.length} of {FORM_LIMIT}</span>
          <span className="text-muted-foreground"> forms used</span>
        </div>
        {forms.length >= FORM_LIMIT && (
          <div className="text-muted-foreground">Delete an unused form before creating another.</div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold">Form</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Submissions</TableHead>
              <TableHead className="font-semibold">Created</TableHead>
              <TableHead className="w-64 text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  Loading forms...
                </TableCell>
              </TableRow>
            )}
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
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/forms/${form.id}/submissions`)}>
                      <Inbox className="size-4" />
                      Submissions
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8" aria-label={`More actions for ${form.title}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setPreviewForm(form)}>
                          <Eye className="mr-2 size-4" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/forms/${form.id}/edit`)}>
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleStatus(form)}>
                          <Power className="mr-2 size-4" />
                          {form.status === "active" ? "Disable form" : "Enable form"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => prepareDelete(form)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && forms.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  <div className="mx-auto max-w-sm space-y-3">
                    <div className="font-medium text-foreground">No forms yet</div>
                    <div>Create your first reusable form, then assign it securely from a candidate profile.</div>
                    <Button type="button" onClick={openCreate}>
                      <Plus className="size-4" />
                      New Form
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(previewForm)} onOpenChange={(open) => !open && setPreviewForm(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewForm?.title ?? "Preview form"}</DialogTitle>
          </DialogHeader>
          {previewForm && (
            <div className="flex flex-col gap-5">
              {previewForm.description && <p className="text-sm text-muted-foreground">{previewForm.description}</p>}
              <LeadFormRenderer schema={previewForm.schema} values={{}} disabled onChange={() => {}} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this form and all collected data?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This permanently removes <span className="font-medium text-foreground">{deleteTarget?.title}</span>, frees one form slot, and cannot be undone.
                </p>
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  {deleteLoading || !deleteCounts ? (
                    <div>Counting related records...</div>
                  ) : (
                    <div className="space-y-1">
                      <div>{deleteCounts.submissions} submission{deleteCounts.submissions === 1 ? "" : "s"} will be deleted</div>
                      <div>{deleteCounts.assignments} invitation{deleteCounts.assignments === 1 ? "" : "s"} will be deleted</div>
                      <div>{deleteCounts.uploads} uploaded file record{deleteCounts.uploads === 1 ? "" : "s"} and storage object{deleteCounts.uploads === 1 ? "" : "s"} will be deleted</div>
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={hardDelete}
              disabled={deleteLoading || deleting}
            >
              {deleting ? "Deleting..." : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
