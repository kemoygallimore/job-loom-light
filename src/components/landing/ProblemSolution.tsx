import { XCircle, CheckCircle2 } from "lucide-react";

const problems = [
  "Too many resumes to review manually",
  "Slow, unstructured screening process",
  "No centralized candidate tracking",
  "Poor candidate experience and drop-off",
];

const solutions = [
  "One platform to manage everything",
  "Video screening saves hours per hire",
  "Structured candidate pipeline & dashboard",
  "Easy-to-share job links candidates love",
];

export default function ProblemSolution() {
  return (
    <section className="py-20 md:py-28 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Recruiting is broken.{" "}
            <span className="text-primary">We fixed it.</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Traditional hiring is slow, fragmented, and frustrating for everyone involved.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-10 max-w-4xl mx-auto">
          {/* Problems */}
          <div className="bg-card rounded-2xl border p-6 md:p-8 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
              <XCircle className="w-3.5 h-3.5" />
              Without Silverweb ATS
            </div>
            <ul className="space-y-4">
              {problems.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-destructive/60 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Solutions */}
          <div className="bg-card rounded-2xl border border-primary/20 p-6 md:p-8 space-y-5 shadow-lg shadow-primary/5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              With Silverweb ATS
            </div>
            <ul className="space-y-4">
              {solutions.map((s) => (
                <li key={s} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground font-medium">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
