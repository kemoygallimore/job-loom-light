import { Clock, PhoneOff, TrendingUp, Heart } from "lucide-react";

const benefits = [
  { icon: Clock, title: "Reduce hiring time by 70%", description: "Async screening eliminates back-and-forth scheduling." },
  { icon: PhoneOff, title: "No more screening calls", description: "Candidates record once — you review on your schedule." },
  { icon: TrendingUp, title: "Improve hiring quality", description: "Structured ratings and side-by-side comparisons surface top talent." },
  { icon: Heart, title: "Better candidate experience", description: "Simple, mobile-friendly flow that candidates actually enjoy." },
];

export default function Benefits() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-medium mb-4">
              Why Silverweb ATS
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Measurable impact on your hiring
            </h2>
            <p className="mt-4 text-muted-foreground max-w-lg">
              Every feature is designed to save you time and help you make better hiring decisions.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {benefits.map((b) => (
              <div key={b.title} className="bg-card rounded-2xl border p-5 hover:shadow-md transition-shadow">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <b.icon className="w-4.5 h-4.5 text-primary" />
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
