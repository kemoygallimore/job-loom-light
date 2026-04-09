import { Video, FileText, Link2, LayoutDashboard, Star, Shield, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  {
    icon: Video,
    title: "Video Screening",
    description: "Candidates record responses on their own time. No scheduling, no back-and-forth.",
    badge: "Most Popular",
  },
  {
    icon: FileText,
    title: "Resume Management",
    description: "Upload, store, and view resumes instantly in secure private cloud storage.",
  },
  {
    icon: Link2,
    title: "Shareable Job Links",
    description: "One link per job — share anywhere and collect applications effortlessly.",
  },
  {
    icon: LayoutDashboard,
    title: "Candidate Dashboard",
    description: "Track every applicant, their status, and full history in one unified view.",
  },
  {
    icon: Star,
    title: "Rating & Reviews",
    description: "Score and compare candidates with a built-in star rating workflow.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "All data encrypted. Private file storage with signed, time-limited access URLs.",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Features</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Everything you need to hire better
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            A complete toolkit designed to make hiring fast, fair, and organized.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group relative bg-card rounded-2xl border p-6 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5"
            >
              {f.badge && (
                <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                  {f.badge}
                </span>
              )}
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <f.icon className="w-5 h-5 text-primary group-hover:text-primary-foreground transition-colors" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link to="/auth" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4">
            Explore all features <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
