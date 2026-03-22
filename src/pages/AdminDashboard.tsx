import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Plus, Users, ChevronRight } from "lucide-react";

interface Company {
  id: string;
  name: string;
  created_at: string;
}

interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  company_id: string;
}

interface UserRole {
  user_id: string;
  role: string;
}

export default function AdminDashboard() {
  const { role } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyUsers, setCompanyUsers] = useState<(UserProfile & { role?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  // Create company form
  const [newCompanyName, setNewCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    const { data, error } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load companies");
    } else {
      setCompanies(data ?? []);
    }
    setLoading(false);
  };

  const fetchCompanyUsers = async (company: Company) => {
    setSelectedCompany(company);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .eq("company_id", company.id);

    if (!profiles) {
      setCompanyUsers([]);
      return;
    }

    const userIds = profiles.map(p => p.user_id);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    const roleMap = new Map((roles ?? []).map(r => [r.user_id, r.role]));
    setCompanyUsers(profiles.map(p => ({ ...p, role: roleMap.get(p.user_id) ?? "user" })));
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim() || !adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      toast.error("All fields are required");
      return;
    }
    setCreating(true);

    // 1. Create company
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({ name: newCompanyName.trim() })
      .select()
      .single();

    if (companyError || !company) {
      toast.error("Failed to create company: " + (companyError?.message ?? ""));
      setCreating(false);
      return;
    }

    // 2. Create auth user via edge function or sign up
    // We use supabase.auth.signUp but note this will sign in as that user
    // For a proper super admin flow, an edge function with service_role would be better
    // For now, we use the admin API approach via edge function
    const { data: authData, error: authError } = await supabase.functions.invoke("create-company-admin", {
      body: {
        company_id: company.id,
        admin_name: adminName.trim(),
        admin_email: adminEmail.trim(),
        admin_password: adminPassword.trim(),
      },
    });

    if (authError || authData?.error) {
      toast.error("Failed to create admin user: " + (authError?.message ?? authData?.error ?? ""));
      setCreating(false);
      return;
    }

    toast.success(`Company "${company.name}" created with admin user`);
    setCreating(false);
    setCreateOpen(false);
    setNewCompanyName("");
    setAdminName("");
    setAdminEmail("");
    setAdminPassword("");
    fetchCompanies();
  };

  if (role !== "super_admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Access denied. Super admin only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Super Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage all companies and users</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Create Company</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Company</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateCompany} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Admin Name</Label>
                <Input value={adminName} onChange={e => setAdminName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Admin Email</Label>
                <Input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Admin Password</Label>
                <Input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? "Creating..." : "Create Company & Admin"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Companies List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="w-5 h-5" /> Companies
            </CardTitle>
            <CardDescription>{companies.length} total</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-center text-muted-foreground">Loading...</div>
            ) : companies.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No companies yet</div>
            ) : (
              <div className="divide-y">
                {companies.map(company => (
                  <button
                    key={company.id}
                    onClick={() => fetchCompanyUsers(company)}
                    className={`w-full flex items-center justify-between px-6 py-3 text-left hover:bg-muted/50 transition-colors ${
                      selectedCompany?.id === company.id ? "bg-muted" : ""
                    }`}
                  >
                    <div>
                      <div className="font-medium text-sm">{company.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(company.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Company Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5" />
              {selectedCompany ? `Users — ${selectedCompany.name}` : "Select a company"}
            </CardTitle>
            {selectedCompany && (
              <CardDescription>{companyUsers.length} users</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!selectedCompany ? (
              <p className="text-sm text-muted-foreground">Click a company to view its users.</p>
            ) : companyUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users in this company.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {user.role}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
