import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, UserMinus, UserCheck, Pencil } from "lucide-react";

type Role = "admin" | "recruiter";

interface ProfileRow {
  user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  role: Role | null;
}

interface Props {
  companyId: string;
  seatLimit: number | null;
}

export default function CompanyUsersTab({ companyId, seatLimit }: Props) {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ProfileRow | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("recruiter");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: profiles } = await (supabase as any)
      .from("profiles")
      .select("user_id, name, email, is_active")
      .eq("company_id", companyId)
      .order("name");
    const ids = (profiles ?? []).map((p: any) => p.user_id);
    const rolesByUser: Record<string, Role | null> = {};
    if (ids.length) {
      const { data: ur } = await (supabase as any)
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      (ur ?? []).forEach((r: any) => {
        if (r.role === "admin" || r.role === "recruiter") rolesByUser[r.user_id] = r.role;
      });
    }
    setRows((profiles ?? []).map((p: any) => ({
      user_id: p.user_id,
      name: p.name,
      email: p.email,
      is_active: p.is_active ?? true,
      role: rolesByUser[p.user_id] ?? null,
    })));
    setLoading(false);
  }, [companyId]);

  useEffect(() => { refresh(); }, [refresh]);

  const activeCount = rows.filter((r) => r.is_active).length;
  const seatBlocked = seatLimit != null && activeCount >= seatLimit;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error("All fields required");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("create-company-admin", {
      body: {
        company_id: companyId,
        admin_name: name.trim(),
        admin_email: email.trim(),
        admin_password: password,
        role,
      },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Failed");
      return;
    }
    toast.success("User created");
    setCreateOpen(false);
    setName(""); setEmail(""); setPassword(""); setRole("recruiter");
    refresh();
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("manage-company-user", {
      body: {
        action: "update",
        company_id: companyId,
        target_user_id: editing.user_id,
        name: editing.name,
        role: editing.role ?? "recruiter",
      },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Failed");
      return;
    }
    toast.success("Saved");
    setEditing(null);
    refresh();
  };

  const setActivation = async (row: ProfileRow, activate: boolean) => {
    const verb = activate ? "Reactivate" : "Deactivate";
    if (!confirm(`${verb} ${row.name}?`)) return;
    const { data, error } = await supabase.functions.invoke("manage-company-user", {
      body: {
        action: activate ? "reactivate" : "deactivate",
        company_id: companyId,
        target_user_id: row.user_id,
        role: row.role ?? "recruiter",
      },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Failed");
      return;
    }
    toast.success(`${verb}d`);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground tabular-nums">{activeCount}</strong>
          {seatLimit != null && <> / <strong className="text-foreground tabular-nums">{seatLimit}</strong></>} active seats
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button disabled={seatBlocked} title={seatBlocked ? "Seat limit reached" : ""}>
              <Plus className="w-4 h-4 mr-2" /> Add user
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add user to company</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3 mt-2">
              <div className="space-y-1.5">
                <Label className="text-sm">Full name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Temporary password</Label>
                <Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Role</Label>
                <Select value={role} onValueChange={(v: Role) => setRole(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="recruiter">Recruiter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Creating..." : "Create user"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No users yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-[1%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.user_id}>
                  <TableCell className="font-medium text-sm">{r.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{r.role ?? "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    {r.is_active
                      ? <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                      : <Badge variant="destructive">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(r)}>
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                    </Button>
                    {r.is_active ? (
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setActivation(r, false)}>
                        <UserMinus className="w-3.5 h-3.5 mr-1.5" /> Deactivate
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setActivation(r, true)} disabled={seatBlocked}>
                        <UserCheck className="w-3.5 h-3.5 mr-1.5" /> Reactivate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit user</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3 mt-2">
              <div className="space-y-1.5">
                <Label className="text-sm">Name</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Email (read-only)</Label>
                <Input value={editing.email} disabled />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Role</Label>
                <Select value={editing.role ?? "recruiter"} onValueChange={(v: Role) => setEditing({ ...editing, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="recruiter">Recruiter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busy}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}