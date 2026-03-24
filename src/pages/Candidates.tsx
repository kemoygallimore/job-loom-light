import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileUp, Search, User, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CandidateWithContext {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  resume_url: string | null;
  created_at: string;
  latest_job_title: string | null;
  latest_stage: string | null;
  latest_updated_at: string | null;
}

const STAGE_COLORS: Record<string, string> = {
  applied: "bg-muted text-muted-foreground",
  screening: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  interview: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  offer: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  hired: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function Candidates() {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<CandidateWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editCandidate, setEditCandidate] = useState<CandidateWithContext | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch candidates
      const { data: candidatesData, error: cErr } = await supabase
        .from("candidates")
        .select("*")
        .order("created_at", { ascending: false });

      if (cErr) throw cErr;

      // Fetch applications with job titles for these candidates
      const { data: appsData, error: aErr } = await supabase
        .from("applications")
        .select("candidate_id, stage, updated_at, job_id, jobs(title)")
        .order("updated_at", { ascending: false });

      if (aErr) throw aErr;

      // Build a map of latest application per candidate
      const latestAppMap = new Map<string, { job_title: string; stage: string; updated_at: string }>();
      for (const app of appsData ?? []) {
        if (!latestAppMap.has(app.candidate_id)) {
          const jobTitle = (app as any).jobs?.title ?? null;
          latestAppMap.set(app.candidate_id, {
            job_title: jobTitle,
            stage: app.stage,
            updated_at: app.updated_at,
          });
        }
      }

      const enriched: CandidateWithContext[] = (candidatesData ?? []).map((c) => {
        const latest = latestAppMap.get(c.id);
        return {
          ...c,
          latest_job_title: latest?.job_title ?? null,
          latest_stage: latest?.stage ?? null,
          latest_updated_at: latest?.updated_at ?? null,
        };
      });

      setCandidates(enriched);
    } catch (err: any) {
      setError(err.message ?? "Failed to load candidates");
      toast.error("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) load();
  }, [profile]);

  const filtered = useMemo(() => {
    if (!search.trim()) return candidates;
    const q = search.toLowerCase();
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.includes(q) ?? false) ||
        (c.latest_job_title?.toLowerCase().includes(q) ?? false)
    );
  }, [candidates, search]);

  const uploadResume = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${profile!.company_id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("resumes").upload(path, file);
    if (error) {
      toast.error("Upload failed");
      return null;
    }
    const { data } = supabase.storage.from("resumes").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    let resumeUrl = editCandidate?.resume_url ?? null;
    if (resumeFile) resumeUrl = await uploadResume(resumeFile);

    if (editCandidate) {
      const { error } = await supabase
        .from("candidates")
        .update({ name, email: email || null, phone: phone || null, resume_url: resumeUrl })
        .eq("id", editCandidate.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Candidate updated");
    } else {
      const { error } = await supabase
        .from("candidates")
        .insert({ company_id: profile.company_id, name, email: email || null, phone: phone || null, resume_url: resumeUrl });
      if (error) { toast.error(error.message); return; }
      toast.success("Candidate added");
    }
    resetForm();
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("candidates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Candidate deleted");
    load();
  };

  const openEdit = (c: CandidateWithContext) => {
    setEditCandidate(c);
    setName(c.name);
    setEmail(c.email ?? "");
    setPhone(c.phone ?? "");
    setResumeFile(null);
    setOpen(true);
  };

  const resetForm = () => {
    setOpen(false);
    setEditCandidate(null);
    setName("");
    setEmail("");
    setPhone("");
    setResumeFile(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 animate-fade-in">
        <h1 className="text-2xl font-bold">Candidates</h1>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Candidate</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editCandidate ? "Edit Candidate" : "New Candidate"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Resume</Label><Input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)} /></div>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md animate-fade-in" style={{ animationDelay: "80ms" }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, phone, or job title..."
          className="pl-9 pr-9"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive animate-fade-in">
          {error}
          <Button variant="ghost" size="sm" className="ml-2" onClick={load}>Retry</Button>
        </div>
      )}

      {/* Table */}
      <div
        className="bg-card rounded-xl border overflow-hidden animate-fade-in"
        style={{ animationDelay: "160ms", boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold hidden sm:table-cell">Email</TableHead>
              <TableHead className="font-semibold hidden md:table-cell">Phone</TableHead>
              <TableHead className="font-semibold hidden lg:table-cell">Job Applied</TableHead>
              <TableHead className="font-semibold hidden sm:table-cell">Stage</TableHead>
              <TableHead className="font-semibold">Updated</TableHead>
              <TableHead className="font-semibold w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-28" /></TableCell>
                  <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-36" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <User className="w-8 h-8 text-muted-foreground/40" />
                    <span>{search ? "No matching applicants found" : "No candidates yet. Add your first candidate."}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className="group cursor-pointer" onClick={() => navigate(`/candidates/${c.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm hidden md:table-cell">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-sm hidden lg:table-cell">{c.latest_job_title ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {c.latest_stage ? (
                      <Badge variant="secondary" className={`capitalize text-xs font-medium ${STAGE_COLORS[c.latest_stage] ?? ""}`}>
                        {c.latest_stage}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {new Date(c.latest_updated_at ?? c.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      {c.resume_url && (
                        <a href={c.resume_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8"><FileUp className="w-3.5 h-3.5" /></Button>
                        </a>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                      {role === "admin" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(c.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
