import { useEffect, useMemo, useState } from "react";
import type { LeadForm } from "./types";
import {
  SubmissionTableFilter,
  createSubmissionColumns,
  defaultVisibleAnswerColumnIds,
  type SubmissionSortState,
} from "@/lib/leadFormSubmissionsTable";

export const DEFAULT_PAGE_SIZE = 25;

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

export function useSubmissionTableControls(form: LeadForm | null, formId?: string) {
  const [visibleAnswerColumnIds, setVisibleAnswerColumnIds] = useState<string[]>([]);
  const [columnsInitialized, setColumnsInitialized] = useState(false);
  const [sort, setSort] = useState<SubmissionSortState | null>(null);
  const [filters, setFilters] = useState<SubmissionTableFilter[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setColumnsInitialized(false);
    setVisibleAnswerColumnIds([]);
    setSort(null);
    setFilters([]);
    setPage(1);
  }, [formId]);

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

  const resetColumns = () => {
    if (!form || !formId) return;
    const defaults = defaultVisibleAnswerColumnIds(form.schema);
    setVisibleAnswerColumnIds(defaults);
    window.localStorage.setItem(columnStorageKey(formId), JSON.stringify(defaults));
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

  return {
    answerColumns,
    addFilter,
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
  };
}
