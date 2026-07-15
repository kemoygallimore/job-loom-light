import type { Dispatch, SetStateAction } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Columns3, FileDown, Filter, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type {
  SubmissionFilterOperator,
  SubmissionTableColumn,
  SubmissionTableFilter,
} from "@/lib/leadFormSubmissionsTable";
import type { LeadForm } from "../types";

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

type Props = {
  form: LeadForm;
  submissionsCount: number;
  answerColumns: SubmissionTableColumn[];
  visibleAnswerColumnIds: string[];
  filters: SubmissionTableFilter[];
  filterableColumns: SubmissionTableColumn[];
  onBack: () => void;
  onVisibleAnswerColumnIdsChange: Dispatch<SetStateAction<string[]>>;
  onResetColumns: () => void;
  onFiltersChange: Dispatch<SetStateAction<SubmissionTableFilter[]>>;
  onUpdateFilter: (filterId: string, patch: Partial<SubmissionTableFilter>) => void;
  onAddFilter: () => void;
  onExport: () => void;
  exportDisabled: boolean;
  exporting: boolean;
};

export function SubmissionsHeader({
  form,
  submissionsCount,
  answerColumns,
  visibleAnswerColumnIds,
  filters,
  filterableColumns,
  onBack,
  onVisibleAnswerColumnIdsChange,
  onResetColumns,
  onFiltersChange,
  onUpdateFilter,
  onAddFilter,
  onExport,
  exportDisabled,
  exporting,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="size-9" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{form.title}</h1>
          <p className="text-sm text-muted-foreground">
            {submissionsCount} submissions for this form
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={onExport} disabled={exportDisabled}>
          <FileDown />
          {exporting ? "Exporting..." : "Export"}
        </Button>
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
                  onVisibleAnswerColumnIdsChange((current) =>
                    checked ? [...current, column.id] : current.filter((columnId) => columnId !== column.id),
                  );
                }}
              >
                {column.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <button
              type="button"
              className="w-full px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={onResetColumns}
            >
              Reset columns
            </button>
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
                        onClick={() => onFiltersChange((current) => current.filter((item) => item.id !== filter.id))}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3">
                      <div className="flex flex-col gap-2">
                        <Label>Column</Label>
                        <Select
                          value={filter.columnId}
                          onValueChange={(value) =>
                            onUpdateFilter(filter.id, { columnId: value, operator: "contains", value: "" })
                          }
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
                            onUpdateFilter(filter.id, { operator: value as SubmissionFilterOperator })
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
                            onChange={(event) => onUpdateFilter(filter.id, { value: event.target.value })}
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
              <Button type="button" variant="outline" onClick={() => onFiltersChange([])} disabled={filters.length === 0}>
                Clear
              </Button>
              <Button type="button" onClick={onAddFilter}>
                <Plus className="size-4" />
                Add filter
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
