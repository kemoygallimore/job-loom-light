import type { Dispatch, RefObject, SetStateAction } from "react";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { answerPreview } from "@/lib/leadForms";
import {
  getSubmissionColumnValue,
  submissionValueText,
  type SubmissionSortState,
  type SubmissionTableColumn,
} from "@/lib/leadFormSubmissionsTable";
import { cn } from "@/lib/utils";
import type { LeadFormSubmission } from "../types";

function sortIcon(sort: SubmissionSortState | null, columnId: string) {
  if (sort?.columnId !== columnId) return <ArrowUpDown className="size-3.5" />;
  return sort.direction === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
}

function nextSortState(sort: SubmissionSortState | null, columnId: string): SubmissionSortState | null {
  if (sort?.columnId !== columnId) return { columnId, direction: "asc" };
  if (sort.direction === "asc") return { columnId, direction: "desc" };
  return null;
}

type Props = {
  visibleColumns: SubmissionTableColumn[];
  items: LeadFormSubmission[];
  loading: boolean;
  sort: SubmissionSortState | null;
  tableScrollWidth: number;
  hasHorizontalOverflow: boolean;
  topScrollRef: RefObject<HTMLDivElement>;
  tableScrollRef: RefObject<HTMLDivElement>;
  tableElementRef: RefObject<HTMLTableElement>;
  onSortChange: Dispatch<SetStateAction<SubmissionSortState | null>>;
  onSyncHorizontalScroll: (source: "top" | "table") => void;
  onOpenSubmission: (submission: LeadFormSubmission) => void;
};

export function SubmissionsTable({
  visibleColumns,
  items,
  loading,
  sort,
  tableScrollWidth,
  hasHorizontalOverflow,
  topScrollRef,
  tableScrollRef,
  tableElementRef,
  onSortChange,
  onSyncHorizontalScroll,
  onOpenSubmission,
}: Props) {
  return (
    <div className="rounded-lg border bg-card">
      {hasHorizontalOverflow && (
        <div className="sticky top-0 z-20 rounded-t-lg border-b bg-card/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div
            ref={topScrollRef}
            className="overflow-x-auto overflow-y-hidden"
            onScroll={() => onSyncHorizontalScroll("top")}
            aria-label="Scroll submissions table horizontally"
          >
            <div className="h-3" style={{ width: tableScrollWidth }} />
          </div>
        </div>
      )}

      <div ref={tableScrollRef} className="overflow-x-auto" onScroll={() => onSyncHorizontalScroll("table")}>
        <table ref={tableElementRef} className="w-full caption-bottom text-sm">
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
                      onClick={() => onSortChange((current) => nextSortState(current, column.id))}
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
            {items.map((submission) => (
              <TableRow key={submission.id}>
                {visibleColumns.map((column) => (
                  <TableCell key={column.id} className="max-w-64 whitespace-nowrap">
                    {column.type === "actions" ? (
                      <Button variant="ghost" size="sm" onClick={() => onOpenSubmission(submission)}>
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
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={Math.max(visibleColumns.length, 1)} className="py-12 text-center text-muted-foreground">
                  No submissions match this view.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
