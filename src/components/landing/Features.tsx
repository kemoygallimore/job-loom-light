import { Video, FileText, Link2, LayoutDashboard, Star, Shield } from "lucide-react";

const features = [
  {
    icon: Video,
    title: "Video Screening Interviews",
    description: "Candidates record responses on their own time — no scheduling needed.",
  },
  {
    icon: FileText,
    title: "Resume Management",
    description: "Upload, store, and view resumes instantly in a secure private cloud.",
  },
  {
    icon: Link2,
    title: "Shareable Job Links",
    description: "One link per job — share it anywhere and collect applications effortlessly.",
  },
  {
    icon: LayoutDashboard,
    title: "Candidate Dashboard",
    description: "Track every applicant, their status, and history in one unified view.",
  },
  {
    icon: Star,
    title: "Rating & Review System",
    description: "Score and compare candidates with a built-in star rating workflow.",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "All data encrypted at rest. Private file storage with signed access URLs.",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            Core Features
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Everything you need to hire better
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            A complete toolkit designed to make hiring fast, fair, and organized.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group bg-card rounded-2xl border p-6 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
