import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Star, Users, FileText, Video } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left - Copy */}
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
              <Star className="w-3.5 h-3.5" />
              Trusted by 500+ recruiters worldwide
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
              Hire Smarter.{" "}
              <span className="text-primary">Screen Faster.</span>{" "}
              All in One Place.
            </h1>

            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-lg">
              Streamline your recruitment process with video screening, resume
              tracking, and powerful candidate insights — all from a single
              dashboard.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="gap-2 text-base px-6 h-12 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 text-base px-6 h-12 rounded-xl"
                onClick={() =>
                  document.querySelector("#how-it-works")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                <Play className="w-4 h-4" />
                Book a Demo
              </Button>
            </div>

            <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Free forever plan
              </span>
            </div>
          </div>

          {/* Right - Mock Dashboard */}
          <div className="animate-fade-in relative" style={{ animationDelay: "0.2s" }}>
            <div className="relative bg-card rounded-2xl border shadow-2xl shadow-primary/10 overflow-hidden">
              {/* Top bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-warning/60" />
                  <div className="w-3 h-3 rounded-full bg-success/60" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground">
                    app.silverweb-ats.com
                  </div>
                </div>
              </div>

              {/* Dashboard content */}
              <div className="p-4 space-y-3">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Candidates", value: "1,284", icon: Users },
                    { label: "Videos Reviewed", value: "856", icon: Video },
                    { label: "Resumes", value: "1,102", icon: FileText },
                  ].map((s) => (
                    <div key={s.label} className="bg-muted/40 rounded-xl p-3 text-center">
                      <s.icon className="w-4 h-4 text-primary mx-auto mb-1" />
                      <div className="text-lg font-bold text-foreground">{s.value}</div>
                      <div className="text-[10px] text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Candidate list mock */}
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

            {/* Floating accent elements */}
            <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-2xl bg-accent/10 blur-xl -z-10" />
            <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-primary/10 blur-xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  );
}
