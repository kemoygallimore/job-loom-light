import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

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

  const load = async () => {
    const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    setJobs((data as Job[]) ?? []);
  };

  useEffect(() => { if (profile) load(); }, [profile]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Job</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editJob ? "Edit Job" : "New Job"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} />
              </div>
              <div className="space-y-2">
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

      <div className="grid gap-3">
        {jobs.map((job, i) => (
          <Card key={job.id} className="animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <div className="font-semibold">{job.title}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{job.description?.slice(0, 80)}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge-stage ${job.status === "open" ? "badge-hired" : "badge-rejected"}`}>
                  {job.status}
                </span>
                <Button variant="ghost" size="icon" onClick={() => openEdit(job)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                {role === "admin" && (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(job.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {jobs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No jobs yet. Create your first job posting.</div>
        )}
      </div>
    </div>
  );
}
