import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"];

interface Job {
  id: string;
  title: string;
}

interface CandidateFiltersProps {
  stageFilter: string;
  jobFilter: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  repeatOnly: boolean;
  jobs: Job[];
  onStageChange: (val: string) => void;
  onJobChange: (val: string) => void;
  onDateFromChange: (val: Date | undefined) => void;
  onDateToChange: (val: Date | undefined) => void;
  onRepeatOnlyChange: (val: boolean) => void;
  onClearAll: () => void;
  activeCount: number;
}

export default function CandidateFilters({
  stageFilter, jobFilter, dateFrom, dateTo, repeatOnly, jobs,
  onStageChange, onJobChange, onDateFromChange, onDateToChange,
  onRepeatOnlyChange, onClearAll, activeCount,
}: CandidateFiltersProps) {
  return (
    <div className="space-y-3 animate-fade-in" style={{ animationDelay: "120ms" }}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Filter className="w-3.5 h-3.5" />
          Filters
        </div>

        {/* Stage */}
        <Select value={stageFilter} onValueChange={onStageChange}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="All stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All stages</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Job */}
        <Select value={jobFilter} onValueChange={onJobChange}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="All jobs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All jobs</SelectItem>
            {jobs.map((j) => (
              <SelectItem key={j.id} value={j.id} className="text-xs">{j.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date from */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="w-3 h-3" />
              {dateFrom ? format(dateFrom, "MMM d, yyyy") : "From date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={onDateFromChange} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        {/* Date to */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="w-3 h-3" />
              {dateTo ? format(dateTo, "MMM d, yyyy") : "To date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={onDateToChange} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        {/* Repeat applicants */}
        <Button
          variant={repeatOnly ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => onRepeatOnlyChange(!repeatOnly)}
        >
          Repeat Applicants
        </Button>

        {/* Clear */}
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground" onClick={onClearAll}>
            <X className="w-3 h-3" />
            Clear ({activeCount})
          </Button>
        )}
      </div>
    </div>
  );
}
