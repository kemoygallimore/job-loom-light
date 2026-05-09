import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, ArrowRight, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { htmlToPlainText } from "@/lib/htmlToPlainText";

interface Job {
  id: string;
  title: string;
  description: string | null;
}

interface Company {
  id: string;
  name: string;
}

export default function CareersPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!companySlug) return;

    const fetch = async () => {
      const { data: companyData } = await supabase
        .from("companies")
        .select("id, name")
        .eq("slug", companySlug)
        .maybeSingle();

      if (!companyData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setCompany(companyData);

      const { data: jobsData } = await supabase
        .from("jobs")
        .select("id, title, description")
        .eq("company_id", companyData.id)
        .eq("status", "open")
        .order("created_at", { ascending: false });

      setJobs(jobsData ?? []);
      setLoading(false);
    };

    fetch();
  }, [companySlug]);

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-xl font-semibold">Company not found</h1>
          <p className="text-muted-foreground text-sm mt-2">
            The company you're looking for doesn't exist or the link is incorrect.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          {loading ? (
            <>
              <Skeleton className="h-8 w-48 mb-3" />
              <Skeleton className="h-5 w-64" />
            </>
          ) : (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ lineHeight: 1.1 }}>
                  {company?.name}
                </h1>
              </div>
              <p className="text-muted-foreground">
                We're hiring! Explore our open positions and join the team.
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Jobs */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <Briefcase className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <h2 className="text-lg font-semibold">No open positions</h2>
            <p className="text-muted-foreground text-sm mt-1.5">
              There are no open positions available at this time. Check back later!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-medium animate-fade-in">
              {jobs.length} open position{jobs.length !== 1 ? "s" : ""}
            </p>
            {jobs.map((job, i) => (
              <Link
                key={job.id}
                to={`/${companySlug}/careers/${job.id}`}
                className="group block rounded-xl border bg-card p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-200 animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-semibold group-hover:text-primary transition-colors">
                      {job.title}
                    </h3>
                    {job.description && (
                      <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                        {htmlToPlainText(job.description)}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-0.5 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-center">
          <p className="text-xs text-muted-foreground/50">
            Powered by <span className="font-medium">HireFlow</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
