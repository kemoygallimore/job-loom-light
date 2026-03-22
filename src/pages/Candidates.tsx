import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileUp, Mail, Phone } from "lucide-react";

interface Candidate {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  resume_url: string | null;
  created_at: string;
}

export default function Candidates() {
  const { profile, role } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [open, setOpen] = useState(false);
  const [editCandidate, setEditCandidate] = useState<Candidate | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const load = async () => {
    const { data } = await supabase.from("candidates").select("*").order("created_at", { ascending: false });
    setCandidates((data as Candidate[]) ?? []);
  };

  useEffect(() => { if (profile) load(); }, [profile]);

  const uploadResume = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${profile!.company_id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("resumes").upload(path, file);
    if (error) { toast.error("Upload failed"); return null; }
    const { data } = supabase.storage.from("resumes").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    let resumeUrl = editCandidate?.resume_url ?? null;
    if (resumeFile) {
      resumeUrl = await uploadResume(resumeFile);
    }

    if (editCandidate) {
      const { error } = await supabase.from("candidates").update({ name, email: email || null, phone: phone || null, resume_url: resumeUrl }).eq("id", editCandidate.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Candidate updated");
    } else {
      const { error } = await supabase.from("candidates").insert({ company_id: profile.company_id, name, email: email || null, phone: phone || null, resume_url: resumeUrl });
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

  const openEdit = (c: Candidate) => {
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Candidates</h1>
        <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Candidate</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editCandidate ? "Edit Candidate" : "New Candidate"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Resume</Label>
                <Input type="file" accept=".pdf,.doc,.docx" onChange={e => setResumeFile(e.target.files?.[0] ?? null)} />
              </div>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {candidates.map((c, i) => (
          <Card key={c.id} className="animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                  {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.resume_url && (
                  <a href={c.resume_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon"><FileUp className="w-4 h-4" /></Button>
                  </a>
                )}
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                {role === "admin" && (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {candidates.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No candidates yet. Add your first candidate.</div>
        )}
      </div>
    </div>
  );
}
