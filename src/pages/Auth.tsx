import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import rizonhireLogo from "@/assets/RH logo white.png";

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-sidebar text-sidebar-foreground flex-col justify-between p-10">
        <div className="flex items-center gap-2.5">
          <img src={rizonhireLogo} alt="RizonHire" className="h-9 w-auto brightness-0 invert" />
        </div>
        <div className="animate-fade-in-up">
          <h1 className="text-3xl font-bold leading-tight" style={{ lineHeight: "1.15" }}>
            Hire smarter,
            <br />
            not harder.
          </h1>
          <p className="mt-4 text-sidebar-foreground/60 max-w-sm leading-relaxed">
            Track candidates, manage pipelines, and collaborate with your team — all in one place.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/30">© {new Date().getFullYear()} RizonHire</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <img src={rizonhireLogo} alt="RizonHire" className="h-8 w-auto" />
          </div>

          <h2 className="text-2xl font-bold">Welcome back</h2>
          <p className="text-muted-foreground mt-1.5 text-sm">Sign in to your dashboard</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Forgot password?
              </button>
            </div>
            <Button type="submit" className="w-full h-11 mt-2" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
