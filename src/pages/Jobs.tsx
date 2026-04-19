import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Link2, Check, Video, ChevronDown, CalendarIcon, Copy, AlertCircle } from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";

interface Job {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
}

export default function Jobs() {
  const { profile, role, user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [open, setOpen] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("open");
  const [search, setSearch] = useState("");
  const [companySlug, setCompanySlug] = useState<string | null>(null);
  const [maxOpenJobs, setMaxOpenJobs] = useState<number>(5);
  const [copied, setCopied] = useState(false);
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"open" | "closed">("open");
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);

  // Screening defaults
  const [screeningOpen, setScreeningOpen] = useState(false);
  const [screeningQuestion, setScreeningQuestion] = useState("Tell us about yourself and why you're interested in this role.");
  const [screeningExpiry, setScreeningExpiry] = useState<Date | undefined>(addDays(new Date(), 7));

  const load = async () => {
    const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    setJobs((data as Job[]) ?? []);
  };

  useEffect(() => {
    if (!profile) return;
    load();
    supabase.from("companies").select("slug, max_open_jobs").eq("id", profile.company_id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCompanySlug((data as any).slug);
          setMaxOpenJobs((data as any).max_open_jobs ?? 5);
        }
      });
  }, [profile]);

  const openJobsCount = jobs.filter(j => j.status === "open").length;
  const atLimit = openJobsCount >= maxOpenJobs;

  const careersUrl = companySlug ? `${window.location.origin}/careers/${companySlug}` : null;

  const handleCopyLink = async () => {
    if (!careersUrl) return;
    await navigator.clipboard.writeText(careersUrl);
    setCopied(true);
    toast.success("Careers link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    // Limit check: only when creating a new open job, or reopening an existing one
    const willBeOpen = status === "open";
    const wasOpen = editJob?.status === "open";
    const wouldAddOpenJob = willBeOpen && (!editJob || !wasOpen);
    if (wouldAddOpenJob && openJobsCount >= maxOpenJobs) {
      setLimitDialogOpen(true);
      return;
    }

    if (editJob) {
      const { error } = await supabase.from("jobs").update({ title, description, status: status as any }).eq("id", editJob.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Job updated");
    } else {
      const { data: newJob, error } = await supabase.from("jobs").insert({ company_id: profile.company_id, title, description, status: status as any }).select().single();
      if (error) { toast.error(error.message); return; }
      if (newJob && user) {
        await supabase.from("screening_jobs").insert({
          company_id: profile.company_id,
          created_by: user.id,
          title,
          question: screeningQuestion,
          expires_at: (screeningExpiry ?? addDays(new Date(), 7)).toISOString(),
          job_id: newJob.id,
        });
      }
      toast.success("Job created");
    }
    resetForm();
    load();
  };

  const handleCloseJob = async (id: string) => {
    const { error } = await supabase.from("jobs").update({ status: "closed" as any }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Job closed");
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Job deleted");
    load();
  };

  const openEdit = (job: Job) => {
    setEditJob(job);
    setTitle(job.title);
    setDescription(job.description ?? "");
    setStatus(job.status);
    setOpen(true);
  };

  const resetForm = () => {
    setOpen(false);
    setEditJob(null);
    setTitle("");
    setDescription("");
    setStatus("open");
    setScreeningOpen(false);
    setScreeningQuestion("Tell us about yourself and why you're interested in this role.");
    setScreeningExpiry(addDays(new Date(), 7));
  };

  const filtered = jobs
    .filter(j => j.status === activeTab)
    .filter(j => j.title.toLowerCase().includes(search.toLowerCase()));

  const openJobsList = jobs.filter(j => j.status === "open");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1 tabular-nums">
            <span className={atLimit ? "text-destructive font-medium" : ""}>{openJobsCount}</span>
            {" / "}{maxOpenJobs} open jobs used
          </p>
        </div>
        <div className="flex items-center gap-2">
          {careersUrl && (
            <Button variant="outline" onClick={handleCopyLink} className="gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Careers Link"}
            </Button>
          )}
          <Dialog
            open={open}
            onOpenChange={v => {
              if (!v) { resetForm(); return; }
              if (atLimit) { setLimitDialogOpen(true); return; }
              setOpen(true);
            }}
          >
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Add Job</Button>
            </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editJob ? "Edit Job" : "New Job"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Screening settings - only for new jobs */}
              {!editJob && (
                <Collapsible open={screeningOpen} onOpenChange={setScreeningOpen}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" className="w-full justify-between px-3 py-2 h-auto text-sm font-medium text-muted-foreground hover:text-foreground">
                      <span className="flex items-center gap-2">
                        <Video className="w-4 h-4" />
                        Video Screening Settings
                      </span>
                      <ChevronDown className={cn("w-4 h-4 transition-transform", screeningOpen && "rotate-180")} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2 border-t mt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Screening Question</Label>
                      <Textarea
                        value={screeningQuestion}
                        onChange={e => setScreeningQuestion(e.target.value)}
                        rows={2}
                        placeholder="e.g. Tell us about your experience with React"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Expiration Date (max 30 days)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal text-sm", !screeningExpiry && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {screeningExpiry ? format(screeningExpiry, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={screeningExpiry}
                            onSelect={setScreeningExpiry}
                            disabled={(date) => date < new Date() || date > addDays(new Date(), 30)}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between flex-wrap gap-3 animate-fade-in" style={{ animationDelay: "80ms" }}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "open" | "closed")}>
          <TabsList>
            <TabsTrigger value="open">
              Active
              <span className="ml-2 text-xs tabular-nums opacity-70">{jobs.filter(j => j.status === "open").length}</span>
            </TabsTrigger>
            <TabsTrigger value="closed">
              Closed
              <span className="ml-2 text-xs tabular-nums opacity-70">{jobs.filter(j => j.status === "closed").length}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-xs w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden animate-fade-in" style={{ animationDelay: "160ms", boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold">Title</TableHead>
              <TableHead className="font-semibold hidden sm:table-cell">Description</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Date</TableHead>
              <TableHead className="font-semibold w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(job => (
              <TableRow key={job.id} className="group">
                <TableCell className="font-medium">{job.title}</TableCell>
                <TableCell className="text-muted-foreground text-sm hidden sm:table-cell max-w-xs truncate">{job.description?.slice(0, 60)}</TableCell>
                <TableCell>
                  <span className={`badge-stage ${job.status === "open" ? "badge-hired" : "badge-rejected"}`}>
                    {job.status}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {new Date(job.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Copy apply link"
                      onClick={async () => {
                        const link = `${window.location.origin}/apply/${job.id}`;
                        await navigator.clipboard.writeText(link);
                        setCopiedJobId(job.id);
                        toast.success("Application link copied!");
                        setTimeout(() => setCopiedJobId(null), 2000);
                      }}
                    >
                      {copiedJobId === job.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(job)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {role === "admin" && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(job.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  {search ? "No jobs match your search" : "No jobs yet. Create your first job posting."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
