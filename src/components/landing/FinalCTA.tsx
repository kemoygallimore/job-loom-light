import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Star } from "lucide-react";

export default function FinalCTA() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/[0.03] to-background" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-primary/[0.04] rounded-full blur-3xl" />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Testimonial */}
        <div className="max-w-lg mx-auto mb-10 bg-card rounded-2xl border p-6 shadow-md">
          <div className="flex justify-center gap-0.5 mb-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-4 h-4 text-warning fill-warning" />
            ))}
          </div>
          <p className="text-sm text-foreground italic leading-relaxed">
            "We replaced 3 different tools with RizonHire. Our time-to-hire dropped from 3 weeks to 5 days. The video screening alone saved us 20 hours a week."
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              JR
            </div>
            <div className="text-left">
              <div className="text-xs font-semibold text-foreground">Jessica Rodriguez</div>
              <div className="text-[11px] text-muted-foreground">Head of Talent, ScaleUp Inc.</div>
            </div>
          </div>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
          Start Hiring Smarter{" "}
          <span className="text-primary">Today</span>
        </h2>
        <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto">
          Join hundreds of teams already using RizonHire to find better candidates, faster. Your next great hire is one link away.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="gap-2 text-base px-8 h-12 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:scale-[1.02] transition-all">
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="gap-2 text-base px-8 h-12 rounded-xl hover:scale-[1.02] transition-all">
            <Play className="w-4 h-4" />
            Book a Demo
          </Button>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          Free forever · No credit card · Setup in 2 minutes
        </p>
      </div>
    </section>
  );
}
