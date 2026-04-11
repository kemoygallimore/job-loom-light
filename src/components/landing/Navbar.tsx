import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Zap } from "lucide-react";
import rizonhireLogo from "@/assets/rizonhire-logo.png";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      {/* Top banner - urgency */}
      <div className="bg-foreground text-background text-center py-2 px-4 text-xs sm:text-sm font-medium">
        <span className="inline-flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-warning" />
          <span>Early access — <strong>Free forever</strong> for the first 200 teams.</span>
          <Link to="/auth" className="underline underline-offset-2 hover:text-primary-foreground/80 ml-1 font-semibold">
            Claim your spot →
          </Link>
        </span>
      </div>

      <header
        className={`sticky top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 backdrop-blur-xl border-b border-border/50 shadow-sm"
            : "bg-white/60 backdrop-blur-md"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            <div className="flex items-center gap-2">
              <img src={rizonhireLogo} alt="RizonHire" className="h-8 w-auto" />
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((l) => (
                <button
                  key={l.href}
                  onClick={() => scrollTo(l.href)}
                  className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                >
                  {l.label}
                </button>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <Link to="/auth">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="sm" className="shadow-md shadow-primary/20">
                  Get Started Free
                </Button>
              </Link>
            </div>

            <button
              className="md:hidden p-2 text-foreground"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-xl border-b border-border animate-fade-in">
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((l) => (
                <button
                  key={l.href}
                  onClick={() => scrollTo(l.href)}
                  className="block w-full text-left px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50"
                >
                  {l.label}
                </button>
              ))}
              <div className="pt-3 flex flex-col gap-2">
                <Link to="/auth">
                  <Button variant="outline" className="w-full">Sign In</Button>
                </Link>
                <Link to="/auth">
                  <Button className="w-full">Get Started Free</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
