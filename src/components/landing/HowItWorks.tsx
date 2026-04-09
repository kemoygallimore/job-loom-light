import { Briefcase, Share2, Video, CheckSquare } from "lucide-react";

const steps = [
  {
    icon: Briefcase,
    title: "Create a Job",
    description: "Set up a posting with screening questions in under 2 minutes.",
    time: "~2 min",
  },
  {
    icon: Share2,
    title: "Share the Link",
    description: "Send the unique job link via email, social, or job boards.",
    time: "Instant",
  },
  {
    icon: Video,
    title: "Candidates Submit",
    description: "Applicants record a video and upload their resume — no account needed.",
    time: "~5 min",
  },
  {
    icon: CheckSquare,
    title: "Review & Shortlist",
    description: "Watch videos, rate candidates, and move the best ones forward.",
    time: "Your pace",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-widest text-accent font-semibold mb-3">How It Works</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            From job post to shortlist in 4 steps
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            The entire flow takes less than 10 minutes to set up. Seriously.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={s.title} className="relative text-center group">
              {/* Connector */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-[60%] w-[80%] h-px border-t-2 border-dashed border-border/60" />
              )}

              <div className="relative z-10 mx-auto w-16 h-16 rounded-2xl bg-card border-2 border-primary/20 flex items-center justify-center mb-4 shadow-md group-hover:border-primary/40 group-hover:shadow-lg transition-all">
                <s.icon className="w-7 h-7 text-primary" />
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-sm">
                  {i + 1}
                </span>
              </div>

              <h3 className="text-base font-semibold text-foreground mb-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px] mx-auto mb-2">
                {s.description}
              </p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                {s.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
