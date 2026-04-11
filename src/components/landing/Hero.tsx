import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Star, Users, FileText, Video, CheckCircle2 } from "lucide-react";

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1600;
          const steps = 40;
          const increment = target / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-lg font-bold text-foreground tabular-nums">
      {count.toLocaleString()}{suffix}
    </div>
  );
}

const avatars = ["SC", "JW", "PP", "AK", "MT"];

export default function Hero() {
  return (
    <section className="relative pt-8 pb-20 md:pt-16 md:pb-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-primary/[0.04] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent/[0.04] rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left */}
          <div className="animate-fade-in-up">
            {/* Social proof badge */}
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-card border shadow-sm mb-8">
              <div className="flex -space-x-2">
                {avatars.map((a, i) => (
                  <div key={i} className="w-6 h-6 rounded-full bg-primary/10 border-2 border-white flex items-center justify-center text-[9px] font-bold text-primary">
                    {a}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-3 h-3 text-warning fill-warning" />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">Loved by 500+ recruiters</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-foreground leading-[1.08] tracking-tight">
              Hire Smarter.{" "}
              <span className="relative">
                <span className="text-primary">Screen Faster.</span>
                <svg className="absolute -bottom-1.5 left-0 w-full" viewBox="0 0 200 8" fill="none">
                  <path d="M2 6C50 2 150 2 198 6" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
                </svg>
              </span>{" "}
              All in One Place.
            </h1>

            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-lg">
              Replace spreadsheets and scattered tools with one platform.{" "}
              <strong className="text-foreground">Video screening, resume tracking, and candidate insights</strong>{" "}
              — ready in 2 minutes.
            </p>

            {/* CTA row */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="gap-2 text-base px-7 h-12 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] transition-all">
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 text-base px-7 h-12 rounded-xl hover:scale-[1.02] transition-all"
                onClick={() =>
                  document.querySelector("#how-it-works")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                <Play className="w-4 h-4" />
                See How It Works
              </Button>
            </div>

            {/* Trust signals */}
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {["No credit card required", "Free forever plan", "Setup in 2 min"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right - Mock Dashboard */}
          <div className="animate-fade-in relative" style={{ animationDelay: "0.15s" }}>
            <div className="relative bg-card rounded-2xl border shadow-2xl shadow-primary/10 overflow-hidden">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-warning/60" />
                  <div className="w-3 h-3 rounded-full bg-success/60" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground">
                    app.rizonhire.com
                  </div>
                </div>
              </div>

              {/* Dashboard */}
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Candidates", value: 1284, icon: Users },
                    { label: "Videos Reviewed", value: 856, icon: Video },
                    { label: "Resumes", value: 1102, icon: FileText },
                  ].map((s) => (
                    <div key={s.label} className="bg-muted/40 rounded-xl p-3 text-center">
                      <s.icon className="w-4 h-4 text-primary mx-auto mb-1" />
                      <AnimatedCounter target={s.value} />
                      <div className="text-[10px] text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Candidate list */}
                <div className="bg-muted/20 rounded-xl border p-3 space-y-2">
                  <div className="text-xs font-medium text-foreground mb-2">Recent Candidates</div>
                  {[
                    { name: "Sarah Chen", role: "Product Designer", status: "Reviewed", color: "bg-success" },
                    { name: "James Wilson", role: "Frontend Dev", status: "Pending", color: "bg-warning" },
                    { name: "Priya Patel", role: "Data Analyst", status: "Shortlisted", color: "bg-primary" },
                    { name: "Alex Kim", role: "UX Researcher", status: "Reviewed", color: "bg-success" },
                  ].map((c) => (
                    <div key={c.name} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                          {c.name[0]}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-foreground">{c.name}</div>
                          <div className="text-[10px] text-muted-foreground">{c.role}</div>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-white ${c.color}`}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating notification card */}
            <div className="absolute -bottom-3 -left-3 sm:-bottom-4 sm:-left-6 bg-card rounded-xl border shadow-lg p-3 animate-fade-in" style={{ animationDelay: "0.8s" }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                </div>
                <div>
                  <div className="text-xs font-medium text-foreground">New submission</div>
                  <div className="text-[10px] text-muted-foreground">Sarah just recorded a video</div>
                </div>
              </div>
            </div>

            {/* Blur accents */}
            <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-2xl bg-accent/10 blur-xl -z-10" />
            <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-primary/10 blur-xl -z-10" />
          </div>
        </div>

        {/* Logo bar */}
        <div className="mt-20 pt-10 border-t border-border/50">
          <p className="text-center text-xs text-muted-foreground uppercase tracking-wider mb-6">
            Trusted by growing teams at
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-10 gap-y-4 opacity-40">
            {["TechCorp", "ScaleUp", "HireBase", "Velocity", "NovaTalent"].map((name) => (
              <span key={name} className="text-lg font-semibold text-foreground tracking-tight">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
