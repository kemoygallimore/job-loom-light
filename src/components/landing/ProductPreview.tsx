import { Play, FileText, Users, Star, MessageSquare } from "lucide-react";

const candidates = [
  { name: "Mia Thompson", role: "Senior UX Designer", rating: 5, status: "Shortlisted", time: "2h ago" },
  { name: "Daniel Park", role: "Full-Stack Engineer", rating: 4, status: "Reviewed", time: "4h ago" },
  { name: "Aisha Mohammed", role: "Product Manager", rating: 4, status: "Pending", time: "6h ago" },
  { name: "Lucas Rivera", role: "Data Scientist", rating: 5, status: "Shortlisted", time: "1d ago" },
  { name: "Emma Watson", role: "DevOps Engineer", rating: 3, status: "Reviewed", time: "1d ago" },
];

const statusStyle: Record<string, string> = {
  Shortlisted: "bg-primary text-white",
  Reviewed: "bg-success text-white",
  Pending: "bg-warning text-white",
};

export default function ProductPreview() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Product Preview</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            See it in action
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            A powerful yet simple interface designed for speed and clarity.
          </p>
        </div>

        <div className="bg-card rounded-2xl border shadow-2xl shadow-primary/5 overflow-hidden max-w-5xl mx-auto">
          {/* Chrome */}
          <div className="flex items-center gap-2 px-5 py-3 border-b bg-muted/30">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive/50" />
              <div className="w-3 h-3 rounded-full bg-warning/50" />
              <div className="w-3 h-3 rounded-full bg-success/50" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-2 px-4 py-1 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                <Users className="w-3 h-3" />
                Candidate Pipeline — Product Designer
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-5">
            {/* List */}
            <div className="md:col-span-3 border-r p-4 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Candidates</h3>
                <span className="text-xs text-muted-foreground">{candidates.length} total</span>
              </div>
              {candidates.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                      {c.name[0]}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {c.name}
                      </div>
                      <div className="text-xs text-muted-foreground">{c.role} · {c.time}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, si) => (
                        <Star
                          key={si}
                          className={`w-3 h-3 ${si < c.rating ? "text-warning fill-warning" : "text-muted"}`}
                        />
                      ))}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusStyle[c.status]}`}>
                      {c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Panel */}
            <div className="md:col-span-2 p-4 space-y-4">
              {/* Video */}
              <div className="bg-foreground/5 rounded-xl aspect-video flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
                <div className="relative w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform">
                  <Play className="w-5 h-5 text-primary ml-0.5" />
                </div>
                <span className="absolute bottom-2 left-2 text-[10px] text-white bg-black/50 px-2 py-0.5 rounded font-medium">
                  Mia Thompson
                </span>
                <span className="absolute bottom-2 right-2 text-[10px] text-white bg-black/50 px-2 py-0.5 rounded">
                  0:28
                </span>
              </div>

              {/* Resume */}
              <div className="bg-muted/40 rounded-xl p-4 border">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-foreground">Resume</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">PDF · 245KB</span>
                </div>
                <div className="space-y-2">
                  {["Experience — 6 years", "Education — Stanford CS", "Skills — Figma, React", "Projects — 12 shipped"].map((s) => (
                    <div key={s} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="bg-muted/40 rounded-xl p-3 border">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-foreground">Team Notes</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  "Strong portfolio. Great communication in the video. Move to final round." — Alex
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
