import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Eye,
  Filter,
  Loader2,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LeadForm,
  LeadFormSubmission,
  LeadFormUpload,
  answerPreview,
  normalizeSchema,
} from "@/lib/leadForms";
import {
  SubmissionFilterOperator,
  SubmissionSortState,
  SubmissionTableColumn,
  SubmissionTableFilter,
  applySubmissionFilters,
  applySubmissionSort,
  createSubmissionColumns,
  defaultVisibleAnswerColumnIds,
  getSubmissionColumnValue,
  paginateSubmissions,
  submissionValueText,
} from "@/lib/leadFormSubmissionsTable";
import { resolveFileUrl } from "@/lib/fileUrl";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

type QueryResult = { data: unknown; error: { message: string } | null };
type LeadFormsQuery = PromiseLike<QueryResult> & {
  select: (columns?: string) => LeadFormsQuery;
  is: (column: string, value: unknown) => LeadFormsQuery;
  order: (column: string, options?: Record<string, unknown>) => LeadFormsQuery;
  update: (payload: unknown) => LeadFormsQuery;
  eq: (column: string, value: unknown) => LeadFormsQuery;
  maybeSingle: () => LeadFormsQuery;
};
type LeadFormsDb = {
  from: (table: string) => LeadFormsQuery;
};

const leadFormsDb = supabase as unknown as LeadFormsDb;

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function makeFilter(columnId: string): SubmissionTableFilter {
  return {
    id: crypto.randomUUID(),
    columnId,
    operator: "contains",
    value: "",
  };
}

function columnStorageKey(formId: string) {
  return `lead-form-submission-columns:${formId}`;
}

function sortIcon(sort: SubmissionSortState | null, columnId: string) {
  if (sort?.columnId !== columnId) return <ArrowUpDown className="size-3.5" />;
  return sort.direction === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
}

function nextSortState(sort: SubmissionSortState | null, columnId: string): SubmissionSortState | null {
  if (sort?.columnId !== columnId) return { columnId, direction: "asc" };
  if (sort.direction === "asc") return { columnId, direction: "desc" };
  return null;
}

function filterOperatorsForColumn(column?: SubmissionTableColumn): { value: SubmissionFilterOperator; label: string }[] {
  const base: { value: SubmissionFilterOperator; label: string }[] = [
    { value: "contains", label: "Contains" },
    { value: "equals", label: "Equals" },
    { value: "is_empty", label: "Is empty" },
    { value: "is_not_empty", label: "Is not empty" },
  ];
  if (column?.type === "submitted") {
    return [...base, { value: "before", label: "Before" }, { value: "after", label: "After" }];
  }
  return base;
}

function operatorNeedsValue(operator: SubmissionFilterOperator) {
  return operator !== "is_empty" && operator !== "is_not_empty";
}

export default function FormSubmissions() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<LeadForm | null>(null);
  const [submissions, setSubmissions] = useState<LeadFormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<LeadFormSubmission | null>(null);
  const [submissionUploads, setSubmissionUploads] = useState<LeadFormUpload[]>([]);
  const [visibleAnswerColumnIds, setVisibleAnswerColumnIds] = useState<string[]>([]);
  const [columnsInitialized, setColumnsInitialized] = useState(false);
  const [sort, setSort] = useState<SubmissionSortState | null>(null);
  const [filters, setFilters] = useState<SubmissionTableFilter[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const load = useCallback(async () => {
    if (!formId) return;
    setLoading(true);
    const [{ data: formRow, error: formError }, { data: submissionRows, error: submissionError }] = await Promise.all([
      leadFormsDb
        .from("lead_forms")
        .select("*")
        .eq("id", formId)
        .is("deleted_at", null)
        .maybeSingle(),
      leadFormsDb
        .from("lead_form_submissions")
        .select("*")
        .eq("form_id", formId)
        .order("created_at", { ascending: false }),
    ]);

    if (formError || !formRow) {
      toast.error(formError?.message ?? "Form not found");
      navigate("/forms", { replace: true });
      return;
    }
    if (submissionError) toast.error(submissionError.message);

    const normalizedForm = {
      ...(formRow as LeadForm),
      schema: normalizeSchema((formRow as LeadForm).schema),
    };
    setForm(normalizedForm);
    setSubmissions(
      ((submissionRows ?? []) as LeadFormSubmission[]).map((submission) => ({
        ...submission,
        schema_snapshot: normalizeSchema(submission.schema_snapshot),
      })),
    );
    setLoading(false);
  }, [formId, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = useMemo(() => (form ? createSubmissionColumns(form.schema) : []), [form]);
  const answerColumns = useMemo(() => columns.filter((column) => column.type === "answer"), [columns]);

  useEffect(() => {
    if (!form || !formId) return;
    const defaults = defaultVisibleAnswerColumnIds(form.schema);
    const raw = window.localStorage.getItem(columnStorageKey(formId));
    if (!raw) {
      setVisibleAnswerColumnIds(defaults);
      setColumnsInitialized(true);
      return;
    }

    try {
      const stored = JSON.parse(raw);
      setVisibleAnswerColumnIds(
        Array.isArray(stored) ? stored.filter((columnId) => defaults.includes(columnId)) : defaults,
      );
    } catch {
      setVisibleAnswerColumnIds(defaults);
    }
    setColumnsInitialized(true);
  }, [form, formId]);

  useEffect(() => {
    if (!formId || !columnsInitialized) return;
    window.localStorage.setItem(columnStorageKey(formId), JSON.stringify(visibleAnswerColumnIds));
  }, [columnsInitialized, formId, visibleAnswerColumnIds]);

  const visibleColumns = useMemo(() => {
    const visibleAnswerSet = new Set(visibleAnswerColumnIds);
    return columns.filter((column) => column.type !== "answer" || visibleAnswerSet.has(column.id));
  }, [columns, visibleAnswerColumnIds]);
  const filterableColumns = useMemo(
    () => visibleColumns.filter((column) => column.type !== "actions"),
    [visibleColumns],
  );

  useEffect(() => {
    const visibleColumnIds = new Set(visibleColumns.map((column) => column.id));
    setFilters((current) => current.filter((filter) => visibleColumnIds.has(filter.columnId)));
    setSort((current) => (current && visibleColumnIds.has(current.columnId) ? current : null));
  }, [visibleColumns]);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize, sort]);

  const filteredSubmissions = useMemo(
    () => applySubmissionFilters(submissions, filterableColumns, filters),
    [filterableColumns, filters, submissions],
  );
  const sortedSubmissions = useMemo(
    () => applySubmissionSort(filteredSubmissions, visibleColumns, sort),
    [filteredSubmissions, sort, visibleColumns],
  );
  const paginated = useMemo(
    () => paginateSubmissions(sortedSubmissions, page, pageSize),
    [page, pageSize, sortedSubmissions],
  );

  useEffect(() => {
    if (paginated.page !== page) setPage(paginated.page);
  }, [page, paginated.page]);

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

  const updateFilter = (filterId: string, patch: Partial<SubmissionTableFilter>) => {
    setFilters((current) =>
      current.map((filter) => (filter.id === filterId ? { ...filter, ...patch } : filter)),
    );
  };

  const addFilter = () => {
    const firstColumn = filterableColumns.find((column) => column.type !== "actions");
    if (!firstColumn) return;
    setFilters((current) => [...current, makeFilter(firstColumn.id)]);
  };

  if (loading || !form) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-9" onClick={() => navigate("/forms")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{form.title}</h1>
            <p className="text-sm text-muted-foreground">
              {submissions.length} submissions for this form
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link to={`/forms/${form.id}/edit`}>Edit form</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Columns3 className="size-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Answer columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {answerColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={visibleAnswerColumnIds.includes(column.id)}
                  onCheckedChange={(checked) => {
                    setVisibleAnswerColumnIds((current) =>
                      checked ? [...current, column.id] : current.filter((columnId) => columnId !== column.id),
                    );
                  }}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant={filters.length > 0 ? "default" : "outline"}>
                <Filter className="size-4" />
                Filters
                {filters.length > 0 && <Badge variant="secondary">{filters.length}</Badge>}
              </Button>
            </SheetTrigger>
            <SheetContent className="flex w-full flex-col sm:max-w-xl">
              <SheetHeader>
                <SheetTitle>Filter submissions</SheetTitle>
                <SheetDescription>Stack filters to narrow this form's submissions.</SheetDescription>
              </SheetHeader>

              <div className="flex flex-1 flex-col gap-3 overflow-y-auto py-4">
                {filters.map((filter) => {
                  const column = filterableColumns.find((item) => item.id === filter.columnId);
                  const operators = filterOperatorsForColumn(column);
                  return (
                    <div key={filter.id} className="rounded-lg border p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <Badge variant="secondary">AND</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => setFilters((current) => current.filter((item) => item.id !== filter.id))}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3">
                        <div className="flex flex-col gap-2">
                          <Label>Column</Label>
                          <Select
                            value={filter.columnId}
                            onValueChange={(value) => updateFilter(filter.id, { columnId: value, operator: "contains", value: "" })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {filterableColumns.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Operator</Label>
                          <Select
                            value={filter.operator}
                            onValueChange={(value) =>
                              updateFilter(filter.id, { operator: value as SubmissionFilterOperator })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {operators.map((operator) => (
                                <SelectItem key={operator.value} value={operator.value}>
                                  {operator.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {operatorNeedsValue(filter.operator) && (
                          <div className="flex flex-col gap-2">
                            <Label>Value</Label>
                            <Input
                              type={column?.type === "submitted" && ["before", "after"].includes(filter.operator) ? "date" : "text"}
                              value={filter.value}
                              onChange={(event) => updateFilter(filter.id, { value: event.target.value })}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filters.length === 0 && (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No filters yet. Add one to narrow the table.
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setFilters([])} disabled={filters.length === 0}>
                  Clear
                </Button>
                <Button type="button" onClick={addFilter}>
                  <Plus className="size-4" />
                  Add filter
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Showing {paginated.startIndex}-{paginated.endIndex} of {sortedSubmissions.length}
          {sortedSubmissions.length !== submissions.length && ` filtered from ${submissions.length}`}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Rows</Label>
          <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {visibleColumns.map((column) => (
                  <TableHead
                    key={column.id}
                    className={cn("min-w-40 whitespace-nowrap font-semibold", column.type === "actions" && "w-24 min-w-24")}
                  >
                    {column.type === "actions" ? (
                      column.label
                    ) : (
                      <button
                        type="button"
                        className="flex items-center gap-2 text-left"
                        onClick={() => setSort((current) => nextSortState(current, column.id))}
                      >
                        {column.label}
                        {sortIcon(sort, column.id)}
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.items.map((submission) => (
                <TableRow key={submission.id}>
                  {visibleColumns.map((column) => (
                    <TableCell key={column.id} className="max-w-64 whitespace-nowrap">
                      {column.type === "actions" ? (
                        <Button variant="ghost" size="sm" onClick={() => openSubmission(submission)}>
                          <Eye className="size-4" />
                          View
                        </Button>
                      ) : column.type === "status" ? (
                        <Badge variant={submission.status === "new" ? "default" : "secondary"}>
                          {submission.status === "new" ? "New" : "Reviewed"}
                        </Badge>
                      ) : column.type === "submitted" ? (
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {format(new Date(submission.created_at), "MMM d, yyyy h:mm a")}
                        </span>
                      ) : (
                        <span className="block truncate" title={submissionValueText(getSubmissionColumnValue(submission, column))}>
                          {answerPreview(getSubmissionColumnValue(submission, column))}
                        </span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {!loading && paginated.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={Math.max(visibleColumns.length, 1)} className="py-12 text-center text-muted-foreground">
                    No submissions match this view.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" disabled={paginated.page <= 1} onClick={() => setPage((current) => current - 1)}>
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <div className="text-sm text-muted-foreground">
          Page {paginated.page} of {paginated.totalPages}
        </div>
        <Button
          variant="outline"
          disabled={paginated.page >= paginated.totalPages}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>

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
