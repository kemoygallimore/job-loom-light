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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Link2, Check } from "lucide-react";

interface Job {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
}

export default function Jobs() {
  const { profile, role } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [open, setOpen] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("open");
  const [search, setSearch] = useState("");
  const [companySlug, setCompanySlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    setJobs((data as Job[]) ?? []);
  };

  useEffect(() => {
    if (!profile) return;
    load();
    // Fetch company slug
    supabase.from("companies").select("slug").eq("id", profile.company_id).maybeSingle()
      .then(({ data }) => { if (data) setCompanySlug(data.slug); });
  }, [profile]);

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
    if (editJob) {
      const { error } = await supabase.from("jobs").update({ title, description, status: status as any }).eq("id", editJob.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Job updated");
    } else {
      const { error } = await supabase.from("jobs").insert({ company_id: profile.company_id, title, description, status: status as any });
      if (error) { toast.error(error.message); return; }
      toast.success("Job created");
    }
    resetForm();
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
  };

  const filtered = jobs.filter(j => j.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 animate-fade-in">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Job</Button>
          </DialogTrigger>
          <DialogContent>
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
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-xs animate-fade-in" style={{ animationDelay: "80ms" }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search jobs..."
          className="pl-9"
        />
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
