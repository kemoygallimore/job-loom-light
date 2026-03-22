import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Briefcase, ArrowRight, Loader2 } from "lucide-react";

export default function Auth() {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !companyName.trim()) {
      toast.error("All fields are required");
      return;
    }
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError || !authData.user) {
      toast.error(authError?.message ?? "Registration failed");
      setLoading(false);
      return;
    }

    const userId = authData.user.id;

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({ name: companyName.trim() } as any)
      .select()
      .single();

    if (companyError || !company) {
      toast.error("Failed to create company");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({ user_id: userId, company_id: company.id, name: name.trim(), email });

    if (profileError) {
      toast.error("Failed to create profile");
      setLoading(false);
      return;
    }

    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });

    if (roleError) {
      toast.error("Failed to assign role");
      setLoading(false);
      return;
    }

    setLoading(false);
    toast.success("Account created! You're now logged in.");
    navigate("/");
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-sidebar text-sidebar-foreground flex-col justify-between p-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-semibold text-lg tracking-tight">HireFlow</span>
        </div>
        <div className="animate-fade-in-up">
          <h1 className="text-3xl font-bold leading-tight" style={{ lineHeight: "1.15" }}>
            Hire smarter,<br />not harder.
          </h1>
          <p className="mt-4 text-sidebar-foreground/60 max-w-sm leading-relaxed">
            Track candidates, manage pipelines, and collaborate with your team — all in one place.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/30">© {new Date().getFullYear()} HireFlow</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg tracking-tight">HireFlow</span>
          </div>

          <h2 className="text-2xl font-bold">
            {isRegister ? "Create your account" : "Welcome back"}
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {isRegister ? "Set up your company and start hiring" : "Sign in to your dashboard"}
          </p>

          <form onSubmit={isRegister ? handleRegister : handleLogin} className="mt-8 space-y-4">
            {isRegister && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="company" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Company Name</Label>
                  <Input id="company" value={companyName} onChange={e => setCompanyName(e.target.value)} required placeholder="Acme Inc." />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Your Name</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} required placeholder="Jane Cooper" />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full h-11 mt-2" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {isRegister ? "Create Account" : "Sign In"}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-primary font-medium hover:underline underline-offset-4"
            >
              {isRegister ? "Sign in" : "Register"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
