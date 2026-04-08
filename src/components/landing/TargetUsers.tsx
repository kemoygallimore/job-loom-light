import { UserCheck, Users, Building2, Briefcase } from "lucide-react";

const audiences = [
  {
    icon: UserCheck,
    title: "Recruiters",
    description: "Screen more candidates in less time with async video interviews.",
  },
  {
    icon: Users,
    title: "HR Teams",
    description: "Centralize your hiring pipeline and collaborate with your team.",
  },
  {
    icon: Building2,
    title: "Agencies",
    description: "Manage multiple clients and roles from a single multi-tenant platform.",
  },
  {
    icon: Briefcase,
    title: "Small Businesses",
    description: "Enterprise-grade hiring tools at a price that works for growing teams.",
  },
];

export default function TargetUsers() {
  return (
    <section className="py-20 md:py-28 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Built for teams like yours
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Whether you're a solo recruiter or a growing HR team, Silverweb ATS scales with you.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
          {audiences.map((a) => (
            <div
              key={a.title}
              className="bg-card rounded-2xl border p-6 text-center hover:border-primary/30 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <a.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">{a.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{a.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
