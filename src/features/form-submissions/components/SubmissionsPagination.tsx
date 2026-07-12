import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
};

export function SubmissionsPagination({ page, totalPages, onPrevious, onNext }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="outline" disabled={page <= 1} onClick={onPrevious}>
        <ChevronLeft className="size-4" />
        Previous
      </Button>
      <div className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </div>
      <Button variant="outline" disabled={page >= totalPages} onClick={onNext}>
        Next
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
