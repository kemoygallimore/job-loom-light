import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Building2, Search, Users, Briefcase, Check, X, Pencil } from "lucide-react";

interface CompanyRow {
  id: string;
  name: string;
  created_at: string;
  max_open_jobs: number;
  userCount: number;
  jobCount: number;
  openJobCount: number;
}

export default function AdminCompanies() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingLimitId, setEditingLimitId] = useState<string | null>(null);
  const [editingLimitValue, setEditingLimitValue] = useState<string>("");

  // form
  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchCompanies = useCallback(async () => {
    const { data: companiesData } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });

    if (!companiesData) { setLoading(false); return; }

    // Get counts per company
    const [profilesRes, jobsRes] = await Promise.all([
      supabase.from("profiles").select("company_id"),
      supabase.from("jobs").select("company_id, status"),
    ]);

    const userCounts: Record<string, number> = {};
    const jobCounts: Record<string, number> = {};
    const openJobCounts: Record<string, number> = {};
    (profilesRes.data ?? []).forEach(p => {
      if (p.company_id) userCounts[p.company_id] = (userCounts[p.company_id] || 0) + 1;
    });
    (jobsRes.data ?? []).forEach((j: any) => {
      if (j.company_id) {
        jobCounts[j.company_id] = (jobCounts[j.company_id] || 0) + 1;
        if (j.status === "open") openJobCounts[j.company_id] = (openJobCounts[j.company_id] || 0) + 1;
      }
    });

    setCompanies(companiesData.map((c: any) => ({
      id: c.id,
      name: c.name,
      created_at: c.created_at,
      max_open_jobs: c.max_open_jobs ?? 5,
      userCount: userCounts[c.id] || 0,
      jobCount: jobCounts[c.id] || 0,
      openJobCount: openJobCounts[c.id] || 0,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      toast.error("All fields are required");
      return;
    }
    setCreating(true);

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({ name: companyName.trim() } as any)
      .select()
      .single();

    if (companyError || !company) {
      toast.error("Failed to create company: " + (companyError?.message ?? ""));
      setCreating(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.functions.invoke("create-company-admin", {
      body: {
        company_id: company.id,
        admin_name: adminName.trim(),
        admin_email: adminEmail.trim(),
        admin_password: adminPassword.trim(),
      },
    });

    if (authError || authData?.error) {
      toast.error("Failed to create admin: " + (authError?.message ?? authData?.error ?? ""));
      setCreating(false);
      return;
    }

    toast.success(`Company "${company.name}" created successfully`);
    setCreating(false);
    setCreateOpen(false);
    setCompanyName("");
    setAdminName("");
    setAdminEmail("");
    setAdminPassword("");
    fetchCompanies();
  };

  const startEditLimit = (c: CompanyRow) => {
    setEditingLimitId(c.id);
    setEditingLimitValue(String(c.max_open_jobs));
  };

  const cancelEditLimit = () => {
    setEditingLimitId(null);
    setEditingLimitValue("");
  };

  const saveLimit = async (companyId: string) => {
    const n = parseInt(editingLimitValue, 10);
    if (isNaN(n) || n < 0 || n > 1000) {
      toast.error("Enter a number between 0 and 1000");
      return;
    }
    const { error } = await supabase
      .from("companies")
      .update({ max_open_jobs: n } as any)
      .eq("id", companyId);
    if (error) { toast.error(error.message); return; }
    toast.success("Open job limit updated");
    setEditingLimitId(null);
    fetchCompanies();
  };

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground text-sm mt-1">{companies.length} registered companies</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="active:scale-[0.97] transition-transform">
              <Plus className="w-4 h-4 mr-2" /> New Company
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Company</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Company Name</Label>
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Corp" required />
              </div>
              <div className="border-t pt-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Admin User</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Full Name</Label>
                    <Input value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Jane Smith" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Email</Label>
                    <Input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="jane@acme.com" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Temporary Password</Label>
                    <Input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required minLength={6} />
                  </div>
                </div>
              </div>
              <Button type="submit" className="w-full active:scale-[0.97] transition-transform" disabled={creating}>
                {creating ? "Creating..." : "Create Company & Admin"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm animate-fade-in" style={{ animationDelay: "80ms" }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search companies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden animate-fade-in" style={{ animationDelay: "160ms" }}>
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "No companies match your search" : "No companies yet"}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Company</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead className="text-center">Jobs</TableHead>
                <TableHead className="text-center">Open / Limit</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(company => (
                <TableRow key={company.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium text-sm">{company.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="gap-1 tabular-nums">
                      <Users className="w-3 h-3" /> {company.userCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="gap-1 tabular-nums">
                      <Briefcase className="w-3 h-3" /> {company.jobCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {editingLimitId === company.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-sm tabular-nums text-muted-foreground">{company.openJobCount} /</span>
                        <Input
                          type="number"
                          min={0}
                          max={1000}
                          value={editingLimitValue}
                          onChange={e => setEditingLimitValue(e.target.value)}
                          className="h-7 w-16 text-sm text-center"
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveLimit(company.id)}>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEditLimit}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditLimit(company)}
                        className="inline-flex items-center gap-1.5 text-sm tabular-nums hover:text-primary transition-colors group"
                        title="Click to edit limit"
                      >
                        <span className={company.openJobCount >= company.max_open_jobs ? "text-destructive font-medium" : ""}>
                          {company.openJobCount}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span>{company.max_open_jobs}</span>
                        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                    {new Date(company.created_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric"
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
