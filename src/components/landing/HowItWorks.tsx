import { Briefcase, Share2, Video, CheckSquare } from "lucide-react";

const steps = [
  {
    icon: Briefcase,
    title: "Create a Job",
    description: "Set up a job posting with screening questions in under 2 minutes.",
  },
  {
    icon: Share2,
    title: "Share the Link",
    description: "Send the unique job link to candidates via email, social, or job boards.",
  },
  {
    icon: Video,
    title: "Candidates Submit",
    description: "Applicants record a video response and upload their resume — no account needed.",
  },
  {
    icon: CheckSquare,
    title: "Review & Shortlist",
    description: "Watch videos, rate candidates, and move the best ones forward in your pipeline.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-medium mb-4">
            Simple Process
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Four steps to better hiring
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            From job creation to candidate shortlisting — all in one streamlined flow.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={s.title} className="relative text-center">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-[60%] w-[80%] h-px bg-border" />
              )}

              <div className="relative z-10 mx-auto w-16 h-16 rounded-2xl bg-card border-2 border-primary/20 flex items-center justify-center mb-4 shadow-md">
                <s.icon className="w-7 h-7 text-primary" />
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
              </div>

              <h3 className="text-base font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px] mx-auto">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
