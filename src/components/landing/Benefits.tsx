import { Clock, PhoneOff, TrendingUp, Heart } from "lucide-react";

const benefits = [
  {
    icon: Clock,
    title: "Reduce hiring time by 70%",
    description: "Async screening eliminates scheduling overhead completely.",
    stat: "70%",
    statLabel: "faster",
  },
  {
    icon: PhoneOff,
    title: "No more screening calls",
    description: "Candidates record once — you review on your own schedule.",
    stat: "15h",
    statLabel: "saved/week",
  },
  {
    icon: TrendingUp,
    title: "Improve hiring quality",
    description: "Structured ratings and side-by-side comparisons surface top talent.",
    stat: "3x",
    statLabel: "better hires",
  },
  {
    icon: Heart,
    title: "Better candidate experience",
    description: "Simple, mobile-friendly flow that candidates actually enjoy completing.",
    stat: "94%",
    statLabel: "completion",
  },
];

export default function Benefits() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-semibold mb-3">Results</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Measurable impact on your hiring
            </h2>
            <p className="mt-4 text-muted-foreground max-w-lg">
              Every feature is designed to save you time and help you make better hiring decisions. Here's what our users report.
            </p>

            {/* Large stat callout */}
            <div className="mt-8 flex items-baseline gap-3">
              <span className="text-6xl font-bold text-primary tabular-nums">70%</span>
              <span className="text-lg text-muted-foreground">reduction in<br />time-to-hire</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {benefits.map((b) => (
              <div key={b.title} className="bg-card rounded-2xl border p-5 hover:shadow-md hover:-translate-y-0.5 transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                    <b.icon className="w-4 h-4 text-primary group-hover:text-primary-foreground transition-colors" />
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary tabular-nums">{b.stat}</div>
                    <div className="text-[10px] text-muted-foreground">{b.statLabel}</div>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{b.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
