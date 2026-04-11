import { UserCheck, Users, Building2, Briefcase, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const audiences = [
  {
    icon: UserCheck,
    title: "Recruiters",
    description: "Screen 5x more candidates in half the time with async video interviews.",
    stat: "70% faster",
  },
  {
    icon: Users,
    title: "HR Teams",
    description: "Centralize your hiring pipeline and collaborate with your entire team.",
    stat: "1 platform",
  },
  {
    icon: Building2,
    title: "Agencies",
    description: "Manage multiple clients and roles from a single multi-tenant platform.",
    stat: "Multi-tenant",
  },
  {
    icon: Briefcase,
    title: "Small Businesses",
    description: "Enterprise-grade hiring tools at a price that works for growing teams.",
    stat: "Free tier",
  },
];

export default function TargetUsers() {
  return (
    <section className="py-20 md:py-28 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Who It's For</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Built for teams like yours
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Whether you're a solo recruiter or a growing HR department, RizonHire scales with you.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
          {audiences.map((a) => (
            <div
              key={a.title}
              className="bg-card rounded-2xl border p-6 text-center hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary transition-colors">
                <a.icon className="w-6 h-6 text-primary group-hover:text-primary-foreground transition-colors" />
              </div>
              <span className="inline-block px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-bold mb-3">
                {a.stat}
              </span>
              <h3 className="text-base font-semibold text-foreground mb-2">{a.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{a.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link to="/auth" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4">
            See how teams use RizonHire <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
