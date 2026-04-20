import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import rizonhireLogo from "@/assets/RH logo black.png";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm animate-fade-in">
        <img src={rizonhireLogo} alt="RizonHire" className="h-12 w-auto mb-10" />

        {sent ? (
          <div className="text-center space-y-3">
            <MailCheck className="w-10 h-10 mx-auto text-primary" />
            <h2 className="text-2xl font-bold">Check your email</h2>
            <p className="text-muted-foreground text-sm">
              We sent a password reset link to <span className="font-medium text-foreground">{email}</span>
            </p>
            <button
              onClick={() => navigate("/auth")}
              className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold">Forgot password?</h2>
            <p className="text-muted-foreground mt-1.5 text-sm">Enter your email and we'll send you a reset link</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
              <Button type="submit" className="w-full h-11 mt-2" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Reset Link"}
              </Button>
            </form>

            <button
              onClick={() => navigate("/auth")}
              className="mt-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
