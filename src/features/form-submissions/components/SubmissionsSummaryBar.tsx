import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SubmissionSortState } from "@/lib/leadFormSubmissionsTable";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

type Props = {
  startIndex: number;
  endIndex: number;
  sortedCount: number;
  totalCount: number;
  sort: SubmissionSortState | null;
  filtersCount: number;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
};

export function SubmissionsSummaryBar({
  startIndex,
  endIndex,
  sortedCount,
  totalCount,
  sort,
  filtersCount,
  pageSize,
  onPageSizeChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          Showing {startIndex}-{endIndex} of {sortedCount}
          {sortedCount !== totalCount && ` filtered from ${totalCount}`}
        </span>
        {sort && <Badge variant="secondary">Sorted</Badge>}
        {filtersCount > 0 && (
          <Badge variant="secondary">{filtersCount} filter{filtersCount === 1 ? "" : "s"}</Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">Rows</Label>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
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
  );
}
