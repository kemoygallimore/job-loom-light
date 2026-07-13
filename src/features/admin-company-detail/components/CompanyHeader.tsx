import { Link } from "react-router-dom";
import { ArrowLeft, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CompanySummary } from "../types";

type Props = {
  company: CompanySummary | null;
  jobLimit: number | null;
  seatLimit: number | null;
  onEdit: () => void;
};

export function CompanyHeader({ company, jobLimit, seatLimit, onEdit }: Props) {
  return (
    <>
      <div className="flex items-center gap-3 animate-fade-in">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/companies"><ArrowLeft className="w-4 h-4 mr-1" /> Companies</Link>
        </Button>
      </div>

      <div className="flex items-baseline justify-between flex-wrap gap-3 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">{company?.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant={company?.status === "suspended" ? "destructive" : "secondary"}>
              {company?.status ?? "active"}
            </Badge>
            <span className="text-xs text-muted-foreground tabular-nums">
              Effective limits: <strong className="text-foreground">{jobLimit}</strong> open jobs · <strong className="text-foreground">{seatLimit}</strong> seats
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit company
        </Button>
      </div>
    </>
  );
}
