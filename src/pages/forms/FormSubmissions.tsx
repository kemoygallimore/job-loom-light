import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  getCurrentAccessToken,
  getFormWithSubmissions,
  getSignedUploadUrl,
  getSubmissionUploads,
  markSubmissionReviewed,
} from "@/features/form-submissions/api";
import { FormSubmissionsAccessError, FormSubmissionsLoading } from "@/features/form-submissions/components/FormSubmissionsStates";
import { SubmissionDetailsDialog } from "@/features/form-submissions/components/SubmissionDetailsDialog";
import { SubmissionsHeader } from "@/features/form-submissions/components/SubmissionsHeader";
import { SubmissionsPagination } from "@/features/form-submissions/components/SubmissionsPagination";
import { SubmissionsSummaryBar } from "@/features/form-submissions/components/SubmissionsSummaryBar";
import { SubmissionsTable } from "@/features/form-submissions/components/SubmissionsTable";
import { useSubmissionTableControls } from "@/features/form-submissions/useSubmissionTableControls";
import type { LeadForm, LeadFormSubmission, LeadFormUpload } from "@/features/form-submissions/types";
import { useAuth } from "@/hooks/useAuth";
import {
  applySubmissionFilters,
  applySubmissionSort,
  paginateSubmissions,
} from "@/lib/leadFormSubmissionsTable";
import {
  downloadFormSubmissionsXlsx,
  LARGE_EXPORT_SUBMISSION_THRESHOLD,
} from "@/lib/leadFormSubmissionsExport";

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function FormSubmissions() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [form, setForm] = useState<LeadForm | null>(null);
  const [submissions, setSubmissions] = useState<LeadFormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<LeadFormSubmission | null>(null);
  const [submissionUploads, setSubmissionUploads] = useState<LeadFormUpload[]>([]);
  const [exporting, setExporting] = useState(false);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableElementRef = useRef<HTMLTableElement>(null);
  const syncingScrollRef = useRef(false);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const hasHorizontalOverflow = tableScrollWidth > (tableScrollRef.current?.clientWidth ?? 0) + 1;
  const {
    addFilter,
    answerColumns,
    filterableColumns,
    filters,
    page,
    pageSize,
    resetColumns,
    setFilters,
    setPage,
    setPageSize,
    setSort,
    setVisibleAnswerColumnIds,
    sort,
    updateFilter,
    visibleAnswerColumnIds,
    visibleColumns,
  } = useSubmissionTableControls(form, formId);

  const load = useCallback(async () => {
    if (!formId) {
      setLoading(false);
      navigate("/forms", { replace: true });
      return;
    }
    if (!profile?.company_id) {
      setAccessError("Your account is missing a company profile. Refresh or contact an administrator.");
      setForm(null);
      setSubmissions([]);
      setLoading(false);
      return;
    }
    setAccessError(null);
    setLoading(true);

    try {
      const result = await getFormWithSubmissions(formId, profile.company_id);
      if (result.submissionErrorMessage) toast.error(result.submissionErrorMessage);
      setForm(result.form);
      setSubmissions(result.submissions);
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Form not found"));
      navigate("/forms", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [formId, navigate, profile?.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  const measureTableScrollWidth = useCallback(() => {
    const tableScroller = tableScrollRef.current;
    const tableElement = tableElementRef.current;
    if (!tableScroller) return;

    setTableScrollWidth(
      Math.max(tableScroller.scrollWidth, tableElement?.scrollWidth ?? 0, tableScroller.clientWidth),
    );
  }, []);

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
  }, [page, paginated.page, setPage]);

  useEffect(() => {
    measureTableScrollWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureTableScrollWidth);
      return () => window.removeEventListener("resize", measureTableScrollWidth);
    }

    const observer = new ResizeObserver(measureTableScrollWidth);
    if (tableScrollRef.current) observer.observe(tableScrollRef.current);
    if (tableElementRef.current) observer.observe(tableElementRef.current);
    window.addEventListener("resize", measureTableScrollWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureTableScrollWidth);
    };
  }, [measureTableScrollWidth, paginated.items.length, visibleColumns]);

  const syncHorizontalScroll = useCallback((source: "top" | "table") => {
    if (syncingScrollRef.current) return;

    const topScroller = topScrollRef.current;
    const tableScroller = tableScrollRef.current;
    if (!topScroller || !tableScroller) return;

    syncingScrollRef.current = true;
    if (source === "top") {
      tableScroller.scrollLeft = topScroller.scrollLeft;
    } else {
      topScroller.scrollLeft = tableScroller.scrollLeft;
    }

    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }, []);

  const openSubmission = async (submission: LeadFormSubmission) => {
    setSelectedSubmission(submission);
    setSubmissionUploads(await getSubmissionUploads(submission.id));

    if (submission.status === "new") {
      await markSubmissionReviewed(submission.id);
      setSubmissions((current) =>
        current.map((item) => (item.id === submission.id ? { ...item, status: "reviewed" } : item)),
      );
    }
  };

  const openUpload = async (upload: LeadFormUpload) => {
    try {
      const url = await getSignedUploadUrl(upload, await getCurrentAccessToken());
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not open file"));
    }
  };

  const exportSubmissions = async () => {
    if (!form || submissions.length === 0 || exporting) return;

    if (submissions.length > LARGE_EXPORT_SUBMISSION_THRESHOLD) {
      toast.warning("Large exports may take a moment and can use extra memory on this device.");
    }

    setExporting(true);
    try {
      await downloadFormSubmissionsXlsx(form, submissions);
      toast.success(`Exported ${submissions.length} submission${submissions.length === 1 ? "" : "s"}`);
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not export submissions"));
    } finally {
      setExporting(false);
    }
  };

  if (accessError) {
    return <FormSubmissionsAccessError message={accessError} onBack={() => navigate("/forms")} />;
  }

  if (loading || !form) {
    return <FormSubmissionsLoading />;
  }

  return (
    <div className="flex flex-col gap-6">
      <SubmissionsHeader
        form={form}
        submissionsCount={submissions.length}
        answerColumns={answerColumns}
        visibleAnswerColumnIds={visibleAnswerColumnIds}
        filters={filters}
        filterableColumns={filterableColumns}
        onBack={() => navigate("/forms")}
        onVisibleAnswerColumnIdsChange={setVisibleAnswerColumnIds}
        onResetColumns={resetColumns}
        onFiltersChange={setFilters}
        onUpdateFilter={updateFilter}
        onAddFilter={addFilter}
        onExport={exportSubmissions}
        exportDisabled={submissions.length === 0 || exporting}
        exporting={exporting}
      />

      <SubmissionsSummaryBar
        startIndex={paginated.startIndex}
        endIndex={paginated.endIndex}
        sortedCount={sortedSubmissions.length}
        totalCount={submissions.length}
        sort={sort}
        filtersCount={filters.length}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      />

      <SubmissionsTable
        visibleColumns={visibleColumns}
        items={paginated.items}
        loading={loading}
        sort={sort}
        tableScrollWidth={tableScrollWidth}
        hasHorizontalOverflow={hasHorizontalOverflow}
        topScrollRef={topScrollRef}
        tableScrollRef={tableScrollRef}
        tableElementRef={tableElementRef}
        onSortChange={setSort}
        onSyncHorizontalScroll={syncHorizontalScroll}
        onOpenSubmission={openSubmission}
      />

      <SubmissionsPagination
        page={paginated.page}
        totalPages={paginated.totalPages}
        onPrevious={() => setPage((current) => current - 1)}
        onNext={() => setPage((current) => current + 1)}
      />

      <SubmissionDetailsDialog
        submission={selectedSubmission}
        uploads={submissionUploads}
        onOpenChange={(open) => !open && setSelectedSubmission(null)}
        onOpenUpload={openUpload}
      />
    </div>
  );
}
