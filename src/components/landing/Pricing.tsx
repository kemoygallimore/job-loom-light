import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";

const perks = [
  "Unlimited screening jobs",
  "Video & resume collection",
  "Candidate rating & notes",
  "Shareable job links",
  "Multi-user team access",
  "Private file storage (R2)",
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-28 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Start free and scale as you grow. No credit card required.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="bg-card rounded-2xl border-2 border-primary/30 p-8 text-center shadow-xl shadow-primary/5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
              Most Popular
            </div>

            <div className="mb-6">
              <span className="text-5xl font-bold text-foreground">Free</span>
              <p className="text-sm text-muted-foreground mt-2">No credit card required</p>
            </div>

            <ul className="space-y-3 mb-8 text-left">
              {perks.map((p) => (
                <li key={p} className="flex items-center gap-3 text-sm text-foreground">
                  <Check className="w-4 h-4 text-success flex-shrink-0" />
                  {p}
                </li>
              ))}
            </ul>

            <Link to="/auth">
              <Button className="w-full h-12 text-base rounded-xl gap-2 shadow-lg shadow-primary/20">
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
