import { XCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const problems = [
  "Too many resumes to review manually",
  "Slow, unstructured screening process",
  "No centralized candidate tracking",
  "High candidate drop-off rates",
];

const solutions = [
  "One platform to manage everything",
  "Video screening saves 15+ hours/week",
  "Structured pipeline & real-time dashboard",
  "Beautiful, mobile-friendly candidate flow",
];

export default function ProblemSolution() {
  return (
    <section className="py-20 md:py-28 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">The Problem</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Recruiting is broken.{" "}
            <span className="text-primary">We fixed it.</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Traditional hiring is slow, fragmented, and frustrating — for everyone.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
          {/* Problems */}
          <div className="bg-card rounded-2xl border p-6 md:p-8 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">
              <XCircle className="w-3.5 h-3.5" />
              Without Silverweb ATS
            </div>
            <ul className="space-y-4">
              {problems.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-destructive/50 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{p}</span>
                </li>
              ))}
            </ul>
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground italic">
                "We were losing candidates because our process took 3 weeks." — Hiring Manager
              </p>
            </div>
          </div>

          {/* Solutions */}
          <div className="bg-card rounded-2xl border-2 border-primary/20 p-6 md:p-8 space-y-5 shadow-xl shadow-primary/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -z-0" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                With Silverweb ATS
              </div>
              <ul className="space-y-4 mt-5">
                {solutions.map((s) => (
                  <li key={s} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground font-medium">{s}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Link to="/auth">
                  <Button size="sm" className="gap-1.5 rounded-lg shadow-sm">
                    Try it free <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
