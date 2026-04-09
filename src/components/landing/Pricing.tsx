import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Sparkles, Shield } from "lucide-react";

const perks = [
  "Unlimited screening jobs",
  "Video & resume collection",
  "Candidate rating & notes",
  "Shareable job links",
  "Multi-user team access",
  "Private file storage",
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-28 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Pricing</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Start free — no credit card, no hidden fees. Scale when you're ready.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="bg-card rounded-2xl border-2 border-primary/30 p-8 text-center shadow-xl shadow-primary/5 relative overflow-hidden">
            {/* Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-primary/5 rounded-full blur-3xl -z-0" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6">
                <Sparkles className="w-3 h-3" />
                Early Access
              </div>

              <div className="mb-2">
                <span className="text-5xl font-bold text-foreground">$0</span>
                <span className="text-lg text-muted-foreground ml-1">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Free forever for early adopters. <strong className="text-foreground">Limited spots.</strong>
              </p>

              <ul className="space-y-3 mb-8 text-left">
                {perks.map((p) => (
                  <li key={p} className="flex items-center gap-3 text-sm text-foreground">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>

              <Link to="/auth">
                <Button className="w-full h-12 text-base rounded-xl gap-2 shadow-lg shadow-primary/25 hover:shadow-xl hover:scale-[1.01] transition-all">
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>

              <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="w-3 h-3" />
                No credit card required · Cancel anytime
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
